package org.sourcecode.server.service;


import org.sourcecode.server.entity.Order;
import org.sourcecode.server.entity.Result;
import org.sourcecode.server.entity.User;

/**
 * @ClassName IOrderService
 * @Description IOrderService
 * @Author LiuQi
 */
public interface IOrderService {
    /**
     * createOrder 创建订单
     *
     * @param order {@link Order}
     * @return
     */
    boolean createOrder(Order order);

    boolean createOrders(Order order);
    boolean createOrderToFail(Order order);

    boolean updateOrderBefore(Long orderId, Order order);

    boolean updateOrderAfter(Long orderId, Order order);

    boolean dollar(Long orderId, Order order);

    boolean identity(Long orderId, Order order);

    boolean diff(Order order, Order newOrder);
    boolean diff(Order newOrder);
    boolean diff_(Order newOrder);

    boolean condition(Long orderId, Order order, String condition);
    boolean contextCallContext(Long orderId, Order order);
    boolean subTypeSPEL(Long orderId, Order order);
    boolean variableInfo(Long orderId, Order order);
    Result<Boolean> resultOnSuccess(Long orderId, Order order);
    Result<Boolean> resultOnFail(Long orderId, Order order);
    Result<Boolean> resultNoLogger(Long orderId, Order order);
    boolean globalVariable(Order order);
    boolean globalVariableCover(Order order, User user);
    void fixedCopy(String text);
    void fixedCopy_(User user,User oldUser);
}
