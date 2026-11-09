package main

import (
	"bytes"
	"net/http"
	"os/exec"
	"text/template" // VULNERABILITY: text/template instead of html/template allows SSTI
	"time"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

// AppConfig holds internal application configuration.
// VULNERABILITY: This is intentionally embedded in ReportData so that
// SSTI payloads like {{.Config.SecretKey}} can extract sensitive values.
type AppConfig struct {
	ServerHost string
	DBPath     string
	SecretKey  string
	Version    string
}

// ReportData is the template data object.
// VULNERABILITY: Config field exposes internal secrets to any user-supplied template.
type ReportData struct {
	Name      string
	AccountID string
	Balance   float64
	Date      string
	Config    AppConfig
}

// generateReportRequest is the JSON body for POST /report/generate.
type generateReportRequest struct {
	AccountID string `json:"account_id"`
	Template  string `json:"template"`
}

// dateFilterRequest is the JSON body for POST /report/date-filter.
type dateFilterRequest struct {
	FromDate string `json:"from_date"`
	ToDate   string `json:"to_date"`
}

// appConfig is the application-wide config instance with intentionally
// sensitive-looking values so trainees have a clear SSTI target.
var appConfig = AppConfig{
	ServerHost: "report-svc:8080",
	DBPath:     "/var/data/reports.db",
	SecretKey:  "report-secret",
	Version:    "1.4.2",
}

func main() {
	e := echo.New()

	// CORS: allow all origins (required by training front-end)
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins: []string{"*"},
		AllowMethods: []string{http.MethodGet, http.MethodPost, http.MethodOptions},
		AllowHeaders: []string{"Content-Type", "Authorization"},
	}))

	e.GET("/report/health", healthHandler)
	e.POST("/report/generate", generateReportHandler)
	e.POST("/report/date-filter", dateFilterHandler)

	e.Logger.Fatal(e.Start(":8080"))
}

// healthHandler returns a simple liveness check.
func healthHandler(c echo.Context) error {
	return c.JSON(http.StatusOK, map[string]string{
		"status":  "ok",
		"service": "report-svc",
	})
}

// generateReportHandler — VULNERABLE TO SERVER-SIDE TEMPLATE INJECTION (SSTI)
//
// A05 Lab 12: The handler accepts a user-supplied template string and executes it
// using Go's text/template package. Because text/template does NOT HTML-escape output
// and allows calling exported methods/fields on the data object, an attacker can:
//
//   - Read internal config:  {{.Config.SecretKey}}
//   - Read any exported field: {{.Config.DBPath}}
//   - Call built-in functions: {{printf "%v" .Config}}
//
// The safe fix would be to use html/template AND never accept user-supplied templates.
func generateReportHandler(c echo.Context) error {
	var req generateReportRequest
	if err := c.Bind(&req); err != nil {
		// VULNERABILITY: full error message returned to caller (info disclosure)
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": err.Error(),
		})
	}

	if req.AccountID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "account_id is required",
		})
	}
	if req.Template == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "template is required",
		})
	}

	// Build the data object — Config is intentionally embedded so SSTI can reach it.
	data := ReportData{
		Name:      "Account Holder " + req.AccountID,
		AccountID: req.AccountID,
		Balance:   10234.56,
		Date:      time.Now().Format("2006-01-02"),
		Config:    appConfig, // VULNERABILITY: internal config exposed to template
	}

	// VULNERABILITY: user-supplied template string parsed directly with text/template.
	// text/template does not sanitise output and allows arbitrary field/method traversal.
	tmpl, err := template.New("report").Parse(req.Template)
	if err != nil {
		// VULNERABILITY: parse error details returned to caller (info disclosure)
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "template parse error: " + err.Error(),
		})
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		// VULNERABILITY: execution error details returned to caller (info disclosure)
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "template execute error: " + err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"account_id": req.AccountID,
		"report":     buf.String(),
	})
}

// dateFilterHandler — VULNERABLE TO OS COMMAND INJECTION
//
// A05 Lab 12: The handler takes from_date and to_date strings from JSON and
// concatenates them directly into a shell command string passed to "sh -c".
// An attacker can inject shell metacharacters:
//
//	from_date = "2024-01-01' && id && echo '"
//	→ executes: sh -c "date -d '2024-01-01' && id && echo '' +%s"
//
// The safe fix would be to validate date format with a strict regex/parse,
// then pass values as separate arguments to exec.Command (not via "sh -c").
func dateFilterHandler(c echo.Context) error {
	var req dateFilterRequest
	if err := c.Bind(&req); err != nil {
		// VULNERABILITY: full error message returned to caller (info disclosure)
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": err.Error(),
		})
	}

	if req.FromDate == "" || req.ToDate == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "from_date and to_date are required",
		})
	}

	// VULNERABILITY: user input concatenated directly into a shell command.
	// No sanitisation, no input validation — arbitrary command execution is possible.
	fromCmd := "date -d '" + req.FromDate + "' +%s"
	toCmd := "date -d '" + req.ToDate + "' +%s"

	fromOut, fromErr := exec.Command("sh", "-c", fromCmd).Output() // #nosec G204 -- intentionally vulnerable
	toOut, toErr := exec.Command("sh", "-c", toCmd).Output()       // #nosec G204 -- intentionally vulnerable

	response := map[string]interface{}{
		"from_date":    req.FromDate,
		"to_date":      req.ToDate,
		"from_epoch":   string(fromOut),
		"to_epoch":     string(toOut),
	}

	// VULNERABILITY: execution errors returned verbatim (info disclosure)
	if fromErr != nil {
		response["from_error"] = fromErr.Error()
	}
	if toErr != nil {
		response["to_error"] = toErr.Error()
	}

	return c.JSON(http.StatusOK, response)
}
