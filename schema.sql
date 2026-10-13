

CREATE TABLE IF NOT EXISTS hb_order_users (
  order_id BIGINT NOT NULL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_hb_order_users_order FOREIGN KEY (order_id) REFERENCES hb_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_hb_order_users_user FOREIGN KEY (user_id) REFERENCES hb_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS hb_order_promotions (
  order_id BIGINT NOT NULL PRIMARY KEY,
  code VARCHAR(80) NOT NULL,
  discount_cents INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_hb_order_promotions_order FOREIGN KEY (order_id) REFERENCES hb_orders(id) ON DELETE CASCADE
);
