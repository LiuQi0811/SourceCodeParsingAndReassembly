package org.sourcecode.toolkit.service;


import org.sourcecode.toolkit.bean.LoggerRecord;

import java.util.List;

/**
 * @ClassName ILoggerRecordService
 * @Description ILoggerRecordService
 * @Author LiuQi
 */
public interface ILoggerRecordService {
    List<LoggerRecord> queryLoggerRecord(String bizNo,String type);
}
