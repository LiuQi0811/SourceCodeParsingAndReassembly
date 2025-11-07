package org.sourcecode.server.infrastructure.loggerecord;


import jakarta.annotation.Resource;
import org.sourcecode.server.repository.LoggerRecordRepository;
import org.sourcecode.toolkit.bean.LoggerRecord;
import org.sourcecode.toolkit.service.ILoggerRecordService;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * @ClassName DBLoggerRecordService
 * @Description DBLoggerRecordService
 * @Author LiuQi
 */
@Service
public class DBLoggerRecordService implements ILoggerRecordService {
    @Resource
    private LoggerRecordRepository loggerRecordRepository;

    @Override
    public List<LoggerRecord> queryLoggerRecord(String bizNo, String type) {
        loggerRecordRepository.queryLogger(bizNo, type);
        return List.of();
    }
}
