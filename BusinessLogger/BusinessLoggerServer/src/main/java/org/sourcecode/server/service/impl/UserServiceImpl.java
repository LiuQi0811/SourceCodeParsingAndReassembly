package org.sourcecode.server.service.impl;


import jakarta.annotation.Resource;
import org.sourcecode.server.entity.Order;
import org.sourcecode.server.entity.User;
import org.sourcecode.server.infrastructure.constants.LoggerRecordType;
import org.sourcecode.server.service.IOrderService;
import org.sourcecode.server.service.IUserService;
import org.sourcecode.toolkit.context.LoggerRecordContext;
import org.sourcecode.toolkit.starter.annotation.LoggerRecord;
import org.springframework.beans.BeanUtils;
import org.springframework.context.annotation.Bean;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * @ClassName UserServiceImpl
 * @Description UserServiceImpl
 * @Author LiuQi
 */
@Service
public class UserServiceImpl implements IUserService {
    @Resource
    private IOrderService orderService;

    @Override
    @LoggerRecord(success = "更新了用户信息{_DIFF{#user, #newUser}}",
            type = LoggerRecordType.USER, bizNo = "{{#newUser.id}}",
            extra = "{{#newUser.toString()}}")
    public boolean diffUser(User user, User newUser) {
        return false;
    }

    @Override
    @LoggerRecord(success = "更新{{#user.name}}用户积分信息",
            type = LoggerRecordType.USER, bizNo = "{{#user.id}}",
            extra = "{{#order.toString()}}")
    public boolean globalVariable(User user, Order order) {
        LoggerRecordContext.putGlobalVariable("user", user);
        orderService.globalVariable(order);
        return false;
    }

    @Override
    @LoggerRecord(success = "更新{{#user.name}}用户积分信息",
            type = LoggerRecordType.USER, bizNo = "{{#user.id}}",
            extra = "{{#order.toString()}}")
    public boolean globalVariableCover(User user, Order order) {
        LoggerRecordContext.putGlobalVariable("user", user);
        User newUser = new User();
        BeanUtils.copyProperties(user, newUser);
        newUser.setName("晴雅");
        orderService.globalVariableCover(order, newUser);
        return false;
    }

    @Override
    @LoggerRecord(success = "更新了用户信息{_DIFF{#user, #newUser}}",
            type = LoggerRecordType.USER, bizNo = "{{#newUser.id}}",
            extra = "{{#newUser.toString()}}")
    @LoggerRecord(success = "更新了用户信息{_DIFF{#user, #newUser}}",
            type = LoggerRecordType.ORDER, bizNo = "{{#newUser.id}}",
            extra = "{{#newUser.toString()}}")
    public boolean abstractUser(User user, User newUser) {
        return false;
    }

    @Override
    public boolean interfaceUser(User user, User newUser) {
        return false;
    }

    @Override
    @LoggerRecord(success = "更新了用户信息{_DIFF{#user, #newUser}}",
            type = LoggerRecordType.ORDER, bizNo = "{{#newUser.id}}",
            extra = "{{#newUser.toString()}}")
    public boolean interfaceAndAbstract(User user, User newUser) {
        return false;
    }

    @Override
    @LoggerRecord(success = "{{#user.id}}更新了用户信息{_DIFF{#user, #newUser}}",
            type = LoggerRecordType.USER, bizNo = "{{#newUser.id}}",
            extra = "{{#newUser.toString()}}")
    public boolean diffUser2Expression(User user, User newUser) {
        return false;
    }

    @Override
    @LoggerRecord(success = "更新了用户信息{_DIFF{#newUser}}",
            type = LoggerRecordType.USER, bizNo = "{{#newUser.id}}",
            extra = "{{#newUser.toString()}}")
    public boolean globalVariableDiff(User newUser) {
        return false;
    }
}
