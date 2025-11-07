package org.sourcecode.server.repository.impl;


import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.sourcecode.server.repository.LoggerRecordRepository;
import org.sourcecode.server.repository.entity.LoggerRecordEntity;
import org.sourcecode.server.repository.mapper.LoggerRecordMapper;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * @ClassName LoggerRecordRepositoryImpl
 * @Description LoggerRecordRepositoryImpl
 * @Author LiuQi
 */
@Component
public class LoggerRecordRepositoryImpl extends ServiceImpl<LoggerRecordMapper, LoggerRecordEntity> implements LoggerRecordRepository {
    @Override
    public List<LoggerRecordEntity> queryLogger(String bizNo, String type) {
        LambdaQueryWrapper<LoggerRecordEntity> lambdaQueryWrapper = new LambdaQueryWrapper<>();
        lambdaQueryWrapper.eq(LoggerRecordEntity::getBizNo, bizNo)
                .eq(LoggerRecordEntity::getType, type)
                .orderByDesc(LoggerRecordEntity::getCreateTime);
        return baseMapper.selectList(lambdaQueryWrapper);
    }

    @Override
    public List<LoggerRecordEntity> queryLogger(String bizNo, String type, String subType) {
        System.out.println(" QU2");
        return List.of();
    }

    @Override
    public List<LoggerRecordEntity> queryLogger(String type) {
        System.out.println(" QU3");
        return List.of();
    }
}
