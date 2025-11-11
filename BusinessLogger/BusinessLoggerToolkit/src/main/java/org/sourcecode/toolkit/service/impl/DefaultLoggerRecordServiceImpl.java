package org.sourcecode.toolkit.service.impl;


import org.sourcecode.toolkit.bean.LoggerRecord;
import org.sourcecode.toolkit.service.ILoggerRecordService;

import java.util.List;

/**
 * @ClassName DefaultLoggerRecordServiceImpl
 * @Description DefaultLoggerRecordServiceImpl
 * @Author LiuQi
 */
public class  DefaultLoggerRecordServiceImpl implements ILoggerRecordService {

    @Override
    public List<LoggerRecord> queryLoggerRecord(String bizNo, String type) {
        System.out.println(" DEFAULT 。。。。。。");
        return List.of();
    }

    @Override
    public void record(LoggerRecord loggerRecord) {
        System.out.println(" RE 4 ");
    }
}
