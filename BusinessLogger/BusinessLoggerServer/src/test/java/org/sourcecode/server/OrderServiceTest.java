package org.sourcecode.server;


import jakarta.annotation.Resource;
import org.junit.jupiter.api.Test;
import org.sourcecode.server.entity.Order;
import org.sourcecode.server.service.IOrderService;
import org.sourcecode.toolkit.bean.LoggerRecord;
import org.sourcecode.toolkit.service.ILoggerRecordService;
import org.springframework.util.Assert;

import java.util.List;

/**
 * @ClassName OrderServiceTest
 * @Description OrderServiceTest
 * @Author LiuQi
 */
public class OrderServiceTest extends BaseTest{
    @Resource
    private IOrderService orderService;
    @Resource
    private ILoggerRecordService loggerRecordService;
    @Test
    public void createOrder(){
        Order order = new Order();
        order.setOrderNo("MT0000011");
        order.setProductName("超值优惠红烧肉套餐");
        order.setPurchaseName("云悠悠");
        orderService.createOrder(order);
        List<LoggerRecord> loggerRecordList = loggerRecordService.queryLoggerRecord(order.getOrderNo(), "ORDER");
        System.out.println(" LENGTH " + loggerRecordList.size());
        LoggerRecord  loggerRecord = !loggerRecordList.isEmpty() ? loggerRecordList.get(0) : null;
        if(loggerRecord != null){
            System.out.println(" L " + loggerRecord);
        }
        System.out.println(
                loggerRecord
        );
    }
}
