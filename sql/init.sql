-- 电话号码管理系统 数据库初始化
-- Railway MySQL 会自动创建并注入当前数据库；这里不要 CREATE/USE/DROP，避免连错库或误删数据。

CREATE TABLE IF NOT EXISTS phone_numbers (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    country     VARCHAR(50)  NOT NULL COMMENT '国家',
    region      VARCHAR(100) NOT NULL DEFAULT '' COMMENT '地区',
    number      VARCHAR(30)  NOT NULL COMMENT '号码',
    status      VARCHAR(10)  NOT NULL DEFAULT '未使用' COMMENT '状态: 未使用/已使用',
    used_time   DATETIME     NULL     COMMENT '使用时间',
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_number (number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='电话号码表';

-- 示例数据；重复执行会自动跳过已有号码。
INSERT IGNORE INTO phone_numbers (country, region, number, status, used_time) VALUES
('美国',     '加利福尼亚州', '+1 (555) 123-4567',  '未使用', NULL),
('中国',     '北京',         '+86 138 0013 8000', '未使用', NULL),
('英国',     '伦敦',         '+44 20 7946 0958',  '已使用', '2026-09-22 14:30:00'),
('日本',     '东京',         '+81 90 1234 5678',  '未使用', NULL),
('德国',     '柏林',         '+49 30 12345678',   '未使用', NULL),
('法国',     '巴黎',         '+33 1 23 45 67 89', '已使用', '2026-09-21 09:15:00'),
('韩国',     '首尔',         '+82 10 1234 5678',  '未使用', NULL),
('澳大利亚', '悉尼',         '+61 2 1234 5678',   '未使用', NULL),
('印度',     '孟买',         '+91 98765 43210',   '已使用', '2026-09-20 16:45:00'),
('巴西',     '圣保罗',       '+55 11 91234 5678', '未使用', NULL),
('加拿大',   '多伦多',       '+1 (416) 555-0199', '未使用', NULL),
('意大利',   '罗马',         '+39 06 1234567',    '未使用', NULL);
