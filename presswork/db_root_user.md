CREATE USER 'newuser'@'localhost' IDENTIFIED BY 'StrongPassword123!';

GRANT ALL PRIVILEGES ON mydatabase.* TO 'ecombox'@'localhost';

FLUSH PRIVILEGES;