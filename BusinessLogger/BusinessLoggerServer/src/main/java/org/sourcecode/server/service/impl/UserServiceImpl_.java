
package org.sourcecode.server.service.impl;


import jakarta.annotation.Resource;
import org.sourcecode.server.entity.Order;
import org.sourcecode.server.entity.User;
import org.sourcecode.server.infrastructure.constants.LoggerRecordType;
import org.sourcecode.server.service.IOrderService;
import org.sourcecode.server.service.IUserService;
import org.sourcecode.server.service.IUserService_;
import org.sourcecode.toolkit.context.LoggerRecordContext;
import org.sourcecode.toolkit.starter.annotation.LoggerRecord;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * @ClassName UserServiceImpl
 * @Description UserServiceImpl
 * @Author LiuQi
 */
@Service
public class UserServiceImpl_ implements IUserService_ {
    @Override
    @LoggerRecord(success = "获取用户列表 调用人{{#user}}", type = LoggerRecordType.ORDER, bizNo = "MT00000929")
    public List<User> getUserList(List<String> userIds) {
        LoggerRecordContext.putVariable("user", userIds);
        return List.of();
    }
}
