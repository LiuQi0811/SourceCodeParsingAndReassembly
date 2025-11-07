package org.sourcecode.server.repository.mapper;


import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.sourcecode.server.repository.entity.LoggerRecordEntity;

/**
 * @ClassName LoggerRecordMapper
 * @Description LoggerRecordMapper
 * @Author LiuQi
 */
@Mapper
public interface LoggerRecordMapper extends BaseMapper<LoggerRecordEntity> {
}
