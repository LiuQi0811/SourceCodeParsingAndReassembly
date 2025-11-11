package org.sourcecode.toolkit.service;


import org.springframework.util.StopWatch;

/**
 * @ClassName ILoggerRecordPerformanceMonitor
 * @Description ILoggerRecordPerformanceMonitor
 * @Author LiuQi
 */
public interface ILoggerRecordPerformanceMonitor {
    String MONITOR_NAME = "logger-record-performance";
    String MONITOR_TASK_BEFORE_EXECUTE = "before-execute";
    String MONITOR_TASK_AFTER_EXECUTE = "after-execute";

    void printLogger(StopWatch stopWatch);
}
