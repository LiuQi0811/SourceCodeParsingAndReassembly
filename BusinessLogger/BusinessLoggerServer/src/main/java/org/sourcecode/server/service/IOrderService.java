package org.sourcecode.server.service;


import org.sourcecode.server.entity.Order;

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
}
