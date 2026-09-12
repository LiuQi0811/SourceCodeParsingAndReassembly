###  组合1：一次性载入 + bs4
- LOAD_MODE = "all"
- PARSE_ENGINE = "bs4"

### 组合2：一次性载入 + xpath
- LOAD_MODE = "all"
- PARSE_ENGINE = "xpath"

### 组合3：一次性载入 + regex
- LOAD_MODE = "all"
- PARSE_ENGINE = "regex"

### 组合4：边抓边入队 + bs4
- LOAD_MODE = "stream"
- PARSE_ENGINE = "bs4"

### 组合5：边抓边入队 + xpath
- LOAD_MODE = "stream"
- PARSE_ENGINE = "xpath"

### 组合6：边抓边入队 + regex
- LOAD_MODE = "stream"
- PARSE_ENGINE = "regex"
