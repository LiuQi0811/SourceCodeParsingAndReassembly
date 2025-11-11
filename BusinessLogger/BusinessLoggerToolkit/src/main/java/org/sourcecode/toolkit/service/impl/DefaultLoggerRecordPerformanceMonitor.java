package org.sourcecode.toolkit.service.impl;


import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.sourcecode.toolkit.service.ILoggerRecordPerformanceMonitor;
import org.springframework.util.StopWatch;

/**
 * @ClassName DefaultLoggerRecordPerformanceMonitor
 * @Description DefaultLoggerRecordPerformanceMonitor
 * @Author LiuQi
 */
public class DefaultLoggerRecordPerformanceMonitor implements ILoggerRecordPerformanceMonitor {
    private static final Logger LOGGER = LoggerFactory.getLogger(DefaultLoggerRecordPerformanceMonitor.class);
    @Override
    public void printLogger(StopWatch stopWatch) {
        LOGGER.info(" LoggerRecord Performance={} " ,stopWatch.prettyPrint());
    }
}
