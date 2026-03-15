package org.sourcecode.server.service;



import org.sourcecode.server.entity.Order;
import org.sourcecode.server.entity.User;
import org.sourcecode.server.infrastructure.constants.LoggerRecordType;
import org.sourcecode.toolkit.starter.annotation.LoggerRecord;

import java.util.List;

/**
 * @ClassName IUserService
 * @Description IUserService
 * @Author LiuQi
 */
public interface IUserService {
    boolean diffUser(User user, User newUser);

    boolean globalVariable(User user, Order order);
    boolean globalVariableCover(User user, Order order);
    boolean abstractUser(User user, User newUser);

    @LoggerRecord(success = "更新了用户信息{_DIFF{#user, #newUser}}",
            type = LoggerRecordType.USER, bizNo = "{{#newUser.id}}",
            extra = "{{#newUser.toString()}}")
    @LoggerRecord(success = "更新了用户信息{_DIFF{#user, #newUser}}",
            type = LoggerRecordType.ORDER, bizNo = "{{#newUser.id}}",
            extra = "{{#newUser.toString()}}")
    boolean interfaceUser(User user, User newUser);

    @LoggerRecord(success = "更新了用户信息{_DIFF{#user, #newUser}}",
            type = LoggerRecordType.USER, bizNo = "{{#newUser.id}}",
            extra = "{{#newUser.toString()}}")
    boolean interfaceAndAbstract(User user, User newUser);

    boolean diffUser2Expression(User user, User newUser);
    boolean globalVariableDiff(User newUser);
}
