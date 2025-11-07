package org.sourcecode.server.repository;


import com.baomidou.mybatisplus.extension.service.IService;
import com.mysql.cj.log.Log;
import org.sourcecode.server.repository.entity.LoggerRecordEntity;

import java.util.List;

/**
 * @ClassName LoggerRecordRepository
 * @Description LoggerRecordRepository
 * @Author LiuQi
 */
public interface LoggerRecordRepository extends IService<LoggerRecordEntity> {
    List<LoggerRecordEntity> queryLogger(String bizNo, String type);

    List<LoggerRecordEntity> queryLogger(String bizNo, String type, String subType);

    List<LoggerRecordEntity> queryLogger(String type);

}
