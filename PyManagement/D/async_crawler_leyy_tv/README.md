```plaintext
async_crawler_leyy_tv/
├── requirements.txt
├── config.py
├── main.py
├── core/
│   ├── __init__.py
│   ├── models.py
│   ├── event.py
│   └── engine.py
├── queue/
│   ├── __init__.py
│   ├── base.py
│   ├── memory_queue.py
│   └── sqlite_queue.py
├── parser/
│   ├── __init__.py
│   ├── base.py
│   ├── bs4_parser.py
│   ├── xpath_parser.py
│   ├── regex_parser.py
│   ├── composite_parser.py
│   └── factory.py
├── downloader/
│   ├── __init__.py
│   ├── base.py
│   ├── simple_downloader.py
│   ├── hls_downloader.py
│   ├── dash_downloader.py
│   ├── stream_downloader.py
│   └── factory.py
├── storage/
│   ├── __init__.py
│   └── file_manager.py
├── utils/
│   ├── __init__.py
│   └── encoding.py
└── observers/
    ├── __init__.py
    └── progress_reporter.py
```