#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SQLite 数据库模块 - 记录爬取进度、视频元数据、下载状态
"""
import os
import json
import sqlite3
import logging
from datetime import datetime
from config import DB_PATH, SAVE_DIR

logger = logging.getLogger(__name__)


def ensure_dirs():
    for d in [SAVE_DIR]:
        os.makedirs(d, exist_ok=True)


class Database:
    def __init__(self, db_path=DB_PATH):
        ensure_dirs()
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self._create_tables()

    def _create_tables(self):
        cur = self.conn.cursor()
        cur.executescript("""
            CREATE TABLE IF NOT EXISTS videos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT,
                url TEXT UNIQUE,
                cover TEXT,
                description TEXT,
                director TEXT,
                actors TEXT,
                category TEXT,
                region TEXT,
                language TEXT,
                release_date TEXT,
                update_status TEXT,
                score TEXT,
                play_sources TEXT,   -- JSON
                related_videos TEXT, -- JSON
                status TEXT DEFAULT 'pending',  -- pending/parsed/downloaded/failed
                html_path TEXT,
                created_at TEXT,
                updated_at TEXT
            );

            CREATE TABLE IF NOT EXISTS episodes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                video_id INTEGER,
                source_name TEXT,
                episode_name TEXT,
                episode_url TEXT,
                real_video_url TEXT,
                m3u8_url TEXT,
                video_path TEXT,
                download_status TEXT DEFAULT 'pending',
                created_at TEXT,
                updated_at TEXT,
                FOREIGN KEY(video_id) REFERENCES videos(id)
            );

            CREATE TABLE IF NOT EXISTS crawl_tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                url TEXT UNIQUE,
                task_type TEXT,   -- home/list/detail/play/search
                status TEXT DEFAULT 'pending',  -- pending/success/failed
                priority INTEGER DEFAULT 0,
                retries INTEGER DEFAULT 0,
                last_error TEXT,
                created_at TEXT,
                updated_at TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_videos_url ON videos(url);
            CREATE INDEX IF NOT EXISTS idx_episodes_video ON episodes(video_id);
            CREATE INDEX IF NOT EXISTS idx_tasks_status ON crawl_tasks(status);
        """)
        self.conn.commit()

    # ---------- 任务队列 ----------
    def add_task(self, url, task_type="list", priority=0):
        if not url:
            return
        now = datetime.now().isoformat()
        try:
            self.conn.execute(
                "INSERT OR IGNORE INTO crawl_tasks (url, task_type, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                (url, task_type, priority, now, now)
            )
            self.conn.commit()
        except Exception as e:
            logger.debug(f"add_task 失败: {e}")

    def get_pending_task(self):
        cur = self.conn.execute(
            "SELECT * FROM crawl_tasks WHERE status='pending' ORDER BY priority DESC, id ASC LIMIT 1"
        )
        row = cur.fetchone()
        if row:
            return dict(row)
        return None

    def mark_task(self, url, status, error=None):
        now = datetime.now().isoformat()
        if status == "failed":
            self.conn.execute(
                "UPDATE crawl_tasks SET status=?, retries=retries+1, last_error=?, updated_at=? WHERE url=?",
                (status, str(error)[:500] if error else None, now, url)
            )
        else:
            self.conn.execute(
                "UPDATE crawl_tasks SET status=?, updated_at=? WHERE url=?",
                (status, now, url)
            )
        self.conn.commit()

    # ---------- 视频信息 ----------
    def save_video(self, info):
        now = datetime.now().isoformat()
        cur = self.conn.execute("SELECT id FROM videos WHERE url=?", (info.get("detail_url", info.get("url", "")),))
        row = cur.fetchone()
        url = info.get("detail_url") or info.get("url", "")

        play_sources = json.dumps(info.get("play_urls", []), ensure_ascii=False)
        related = json.dumps(info.get("related_videos", []), ensure_ascii=False)

        if row:
            self.conn.execute("""
                UPDATE videos SET title=?, cover=?, description=?, director=?, actors=?, category=?,
                    region=?, language=?, release_date=?, update_status=?, score=?,
                    play_sources=?, related_videos=?, status='parsed', updated_at=?
                WHERE id=?
            """, (
                info.get("title", ""), info.get("cover", ""), info.get("description", ""),
                info.get("director", ""), info.get("actors", ""), info.get("category", ""),
                info.get("region", ""), info.get("language", ""), info.get("release_date", ""),
                info.get("update_status", ""), info.get("score", ""),
                play_sources, related, now, row["id"]
            ))
            vid = row["id"]
        else:
            cur = self.conn.execute("""
                INSERT INTO videos (title, url, cover, description, director, actors, category, region,
                    language, release_date, update_status, score, play_sources, related_videos,
                    status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'parsed', ?, ?)
            """, (
                info.get("title", ""), url, info.get("cover", ""), info.get("description", ""),
                info.get("director", ""), info.get("actors", ""), info.get("category", ""),
                info.get("region", ""), info.get("language", ""), info.get("release_date", ""),
                info.get("update_status", ""), info.get("score", ""),
                play_sources, related, now, now
            ))
            vid = cur.lastrowid

        # 保存剧集
        for source in info.get("play_urls", []):
            for ep in source.get("episodes", []):
                self._save_episode(vid, source.get("source_name", ""), ep)

        self.conn.commit()
        return vid

    def _save_episode(self, video_id, source_name, ep):
        now = datetime.now().isoformat()
        url = ep.get("url", "")
        self.conn.execute("""
            INSERT OR IGNORE INTO episodes (video_id, source_name, episode_name, episode_url, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (video_id, source_name, ep.get("name", ""), url, now, now))
        self.conn.commit()

    def update_episode_video_url(self, episode_id, real_url="", m3u8_url=""):
        now = datetime.now().isoformat()
        self.conn.execute(
            "UPDATE episodes SET real_video_url=?, m3u8_url=?, updated_at=? WHERE id=?",
            (real_url, m3u8_url, now, episode_id)
        )
        self.conn.commit()

    def get_all_videos(self, status="parsed"):
        cur = self.conn.execute("SELECT * FROM videos WHERE status=?", (status,))
        return [dict(r) for r in cur.fetchall()]

    def get_pending_episodes(self):
        cur = self.conn.execute("SELECT * FROM episodes WHERE download_status='pending' AND real_video_url!=''")
        return [dict(r) for r in cur.fetchall()]

    def get_stats(self):
        cur = self.conn.execute("SELECT COUNT(*) as c FROM videos")
        v = cur.fetchone()["c"]
        cur = self.conn.execute("SELECT COUNT(*) as c FROM episodes")
        e = cur.fetchone()["c"]
        cur = self.conn.execute("SELECT COUNT(*) as c FROM crawl_tasks WHERE status='pending'")
        t = cur.fetchone()["c"]
        return {"videos": v, "episodes": e, "pending_tasks": t}

    def close(self):
        self.conn.close()


db = Database()
