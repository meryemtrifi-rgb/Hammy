CREATE TABLE IF NOT EXISTS hb_schema_versions (
  version VARCHAR(40) NOT NULL PRIMARY KEY,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hb_products (
  id INT NOT NULL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  category VARCHAR(80) NOT NULL,
  price_cents INT NOT NULL,
  description TEXT NOT NULL,
  option_label VARCHAR(80) NOT NULL,
  options_json JSON NOT NULL,
  stock_json JSON NOT NULL,
  images_json JSON NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hb_orders (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_number VARCHAR(32) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(120) NOT NULL,
  last_name VARCHAR(120) NOT NULL,
  address VARCHAR(255) NOT NULL,
  postal_code VARCHAR(5) NOT NULL,
  city VARCHAR(120) NOT NULL,
  country VARCHAR(80) NOT NULL DEFAULT 'France',
  shipping_method ENUM('std','exp') NOT NULL,
  shipping_cents INT NOT NULL,
  subtotal_cents INT NOT NULL,
  total_cents INT NOT NULL,
  payment_method ENUM('stripe','paypal') NOT NULL,
  payment_status ENUM('pending','paid','failed','cancelled') NOT NULL DEFAULT 'pending',
  fulfillment_status ENUM('pending','paid','shipped','delivered','cancelled') NOT NULL DEFAULT 'pending',
  stripe_session_id VARCHAR(255) NULL,
  stripe_payment_intent_id VARCHAR(255) NULL,
  paypal_order_id VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_hb_orders_email (email),
  INDEX idx_hb_orders_payment (payment_status)
);

CREATE TABLE IF NOT EXISTS hb_order_items (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT NOT NULL,
  product_id INT NOT NULL,
  product_name VARCHAR(160) NOT NULL,
  option_value VARCHAR(120) NOT NULL,
  unit_price_cents INT NOT NULL,
  quantity INT NOT NULL,
  CONSTRAINT fk_hb_order_items_order FOREIGN KEY (order_id) REFERENCES hb_orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS hb_payment_events (
  event_id VARCHAR(255) NOT NULL PRIMARY KEY,
  provider ENUM('stripe','paypal') NOT NULL,
  event_type VARCHAR(160) NOT NULL,
  processed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO hb_schema_versions(version) VALUES ('v1');


CREATE TABLE IF NOT EXISTS hb_users (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  open_id VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(160) NOT NULL,
  marketing_consent BOOLEAN NOT NULL DEFAULT FALSE,
  marketing_consent_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_hb_users_email (email)
);

CREATE TABLE IF NOT EXISTS hb_newsletter_subscribers (
  email VARCHAR(255) NOT NULL PRIMARY KEY,
  user_id BIGINT NULL,
  status ENUM('subscribed','unsubscribed') NOT NULL DEFAULT 'subscribed',
  consent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  source VARCHAR(80) NOT NULL DEFAULT 'footer',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_hb_newsletter_user FOREIGN KEY (user_id) REFERENCES hb_users(id) ON DELETE SET NULL
);
