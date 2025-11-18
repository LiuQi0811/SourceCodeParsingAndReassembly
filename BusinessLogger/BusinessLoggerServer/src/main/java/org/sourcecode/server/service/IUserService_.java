package org.sourcecode.server.service;



import org.sourcecode.server.entity.Order;
import org.sourcecode.server.entity.User;

import java.util.List;

/**
 * @ClassName IUserService
 * @Description IUserService
 * @Author LiuQi
 */
public interface IUserService_ {
    List<User> getUserList(List<String> userIds);
}
