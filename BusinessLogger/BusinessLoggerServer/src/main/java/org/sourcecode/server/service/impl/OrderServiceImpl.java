package org.sourcecode.server.service.impl;


import org.sourcecode.server.entity.Order;
import org.sourcecode.server.infrastructure.constants.LoggerRecordType;
import org.sourcecode.server.service.IOrderService;
import org.sourcecode.toolkit.context.LoggerRecordContext;
import org.sourcecode.toolkit.starter.annotation.LoggerRecord;
import org.springframework.stereotype.Service;

/**
 * @ClassName OrderServiceImpl
 * @Description OrderServiceImpl
 * @Author LiuQi
 */
@Service
public class OrderServiceImpl implements IOrderService {
    @Override
    @LoggerRecord(success = "{{#order.purchaseName}}下了一个订单,购买商品「{{#order.productName}}」,变量「{{#innerOrder.productName}}」,下单结果:{{#_result}}", subType = "MANAGER_VIEW", type = LoggerRecordType.ORDER, extra = "{{#order.toString()}}", bizNo = "{{#order.orderNo}}", fail = "创建订单失败，失败原因：「{{#_errorMsg}}」")
    public boolean createOrder(Order order) {
        System.out.printf(" 【创建订单】orderNo %s\n", order.getOrderNo());
        // 创建Order 对象
        final Order orderInfo = new Order();
        orderInfo.setProductName("辣椒炒肉");
        LoggerRecordContext.putVariable("innerOrder", orderInfo);
        return true;
    }
}
