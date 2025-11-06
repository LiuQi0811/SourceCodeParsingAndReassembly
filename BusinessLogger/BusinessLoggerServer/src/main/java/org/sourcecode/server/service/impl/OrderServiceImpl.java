package org.sourcecode.server.service.impl;


import org.sourcecode.server.entity.Order;
import org.sourcecode.server.service.IOrderService;
import org.sourcecode.toolkit.context.LoggerRecordContext;
import org.springframework.stereotype.Service;

/**
 * @ClassName OrderServiceImpl
 * @Description OrderServiceImpl
 * @Author LiuQi
 */
@Service
public class OrderServiceImpl implements IOrderService {
    @Override
    public boolean createOrder(Order order) {
        System.out.printf(" 【创建订单】orderNo %s\n", order.getOrderNo());
        // 创建Order 对象
        final Order orderInfo = new Order();
        orderInfo.setProductName("辣椒炒肉");
        LoggerRecordContext.putVariable("innerOrder", orderInfo);
        return true;
    }
}
