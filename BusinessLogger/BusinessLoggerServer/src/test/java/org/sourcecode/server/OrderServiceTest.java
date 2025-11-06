package org.sourcecode.server;


import jakarta.annotation.Resource;
import org.junit.jupiter.api.Test;
import org.sourcecode.server.entity.Order;
import org.sourcecode.server.service.IOrderService;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * @ClassName OrderServiceTest
 * @Description OrderServiceTest
 * @Author LiuQi
 */
public class OrderServiceTest extends BaseTest{
    @Resource
    private IOrderService orderService;
    @Test
    public void createOrder(){
        Order order = new Order();
        order.setOrderNo("MT0000011");
        order.setProductName("超值优惠红烧肉套餐");
        order.setPurchaseName("云悠悠");
        orderService.createOrder(order);
    }
}
