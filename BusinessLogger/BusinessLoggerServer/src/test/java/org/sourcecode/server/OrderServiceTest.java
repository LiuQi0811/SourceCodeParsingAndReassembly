package org.sourcecode.server;


import jakarta.annotation.Resource;
import org.junit.jupiter.api.Test;
import org.sourcecode.server.entity.Order;
import org.sourcecode.server.entity.User;
import org.sourcecode.server.infrastructure.constants.LoggerRecordType;
import org.sourcecode.server.service.IOrderService;
import org.sourcecode.toolkit.bean.LoggerRecord;
import org.sourcecode.toolkit.service.ILoggerRecordService;
import org.sourcecode.toolkit.starter.support.aop.LoggerRecordInterceptor;
import org.springframework.beans.factory.BeanFactory;
import org.springframework.util.Assert;

import java.util.Arrays;
import java.util.Date;
import java.util.List;

/**
 * @ClassName OrderServiceTest
 * @Description OrderServiceTest
 * @Author LiuQi
 */
public class OrderServiceTest extends BaseTest {
    @Resource
    private IOrderService orderService;
    @Resource
    private ILoggerRecordService loggerRecordService;
    @Resource
    private BeanFactory beanFactory;

    @Test
    public void createOrder() {
        Order order = new Order();
        order.setOrderNo("MT0000011");
        order.setProductName("超值优惠红烧肉套餐");
        order.setPurchaseName("云悠悠");
        order.setCreateTime(new Date());
        orderService.createOrder(order);
        List<LoggerRecord> loggerRecordList = loggerRecordService.queryLoggerRecord(order.getOrderNo(), "ORDER");
        LoggerRecord loggerRecord = !loggerRecordList.isEmpty() ? loggerRecordList.get(0) : null;
        System.out.println(
                loggerRecord
        );
    }

    @Test
    public void createOrders() {
        Order order = new Order();
        order.setOrderNo("YBK0000011");
        order.setProductName("超爽辣子鸡");
        order.setPurchaseName("雾蒙蒙");
        order.setCreateTime(new Date());
        orderService.createOrders(order);
    }

    @Test
    public void createOrderToFail() {
        Order order = new Order();
        order.setOrderNo("SN0000011");
        order.setProductName("香辣牛肉");
        order.setPurchaseName("晴雅");
        try {
            orderService.createOrderToFail(order);
        } finally {
            List<LoggerRecord> loggerRecordList = loggerRecordService.queryLoggerRecord(order.getOrderNo(), LoggerRecordType.ORDER);
            System.out.println("  " + loggerRecordList);
        }
    }

    @Test
    public void updateOrderBefore() {
        Order order = new Order();
        order.setOrderId(100L);
        order.setOrderNo("YBK0000099");
        order.setProductName("拉皮肉丝");
        order.setPurchaseName("关小雨");
        orderService.updateOrderBefore(13L, order);
    }

    @Test
    public void updateOrderAfter() {
        Order order = new Order();
        order.setOrderId(100L);
        order.setOrderNo("YBK0000066");
        order.setProductName("宫保鸡丁");
        order.setPurchaseName("关小雨");
        orderService.updateOrderAfter(13L, order);
    }

    @Test
    public void updateDollar() {
        Order order = new Order();
        order.setOrderId(100L);
        order.setOrderNo("YBK0000066");
        order.setProductName("宫保鸡丁");
        order.setPurchaseName("关小雨");
        orderService.dollar(1L, order);
    }


    @Test
    public void updateIdentity() {
        Order order = new Order();
        order.setOrderId(1001L);
        order.setOrderNo("YBK0000069");
        order.setProductName("宫保鸡丁");
        order.setPurchaseName("关小雨");
        orderService.identity(1L, order);
    }


    @Test
    public void updateDiffOrderOrUser() {
        Order order = new Order();
        order.setOrderId(99L);
        order.setOrderNo("MT0000099");
        order.setProductName("超值优惠红烧肉套餐");
        order.setPurchaseName("汤姆帅锅一枚");
        Order.UserInfo userInfo = new Order.UserInfo();
        userInfo.setUserId(9001L);
        userInfo.setUserName("汤姆");
        order.setCreator(userInfo);
        order.setItems(Arrays.asList("123", "bbb"));


        Order order_ = new Order();
        order_.setOrderId(88L);
        order_.setOrderNo("MT0000099");
        order_.setProductName("麻辣烫套餐");
        order_.setPurchaseName("杰瑞帅锅一枚");
        Order.UserInfo userInfo_ = new Order.UserInfo();
        userInfo_.setUserId(9002L);
        userInfo_.setUserName("杰瑞");
        order_.setCreator(userInfo_);
        order_.setItems(Arrays.asList("123", "aaa"));

        orderService.diff(order, order_);
    }

    @Test
    public void updateDiffOrderAdd() {
        Order order = new Order();
        order.setOrderId(199L);
        order.setOrderNo("MT00000199");
        order.setProductName("水煮肉片");
        order.setPurchaseName("汤姆帅锅一枚");
        order.setItems(null);

        Order order_ = new Order();
        order_.setOrderId(188L);
        order_.setOrderNo("MT00000199");
        order_.setProductName("毛血旺");
        order_.setPurchaseName("杰瑞帅锅一枚");
        order_.setItems(Arrays.asList("123", "aaa"));

        orderService.diff(order, order_);
    }

    @Test
    public void updateDiffOrderDelete() {
        Order order = new Order();
        order.setOrderId(199L);
        order.setOrderNo("MT00000199");
        order.setProductName("水煮肉片");
        order.setPurchaseName("汤姆帅锅一枚");
        order.setItems(Arrays.asList("123", "AAA"));

        Order order_ = new Order();
        order_.setOrderId(188L);
        order_.setOrderNo("MT00000199");
        order_.setProductName("毛血旺");
        order_.setPurchaseName("杰瑞帅锅一枚");
        order_.setItems(null);

        orderService.diff(order, order_);
    }

    @Test
    public void updateOrDeleteDiffOrder() {
        Order order = new Order();
        order.setOrderId(99L);
        order.setOrderNo("MT0000099");
        order.setProductName("超值优惠红烧肉套餐");
        order.setPurchaseName("汤姆帅锅一枚");
        Order.UserInfo userInfo = new Order.UserInfo();
        userInfo.setUserId(9001L);
        userInfo.setUserName("汤姆");
        order.setCreator(userInfo);

        Order order_ = new Order();
        order_.setOrderId(88L);
        order_.setOrderNo("MT0000099");
        order_.setProductName("麻辣烫套餐");
        order_.setPurchaseName("杰瑞帅锅一枚");
        orderService.diff(order, order_);
    }


    @Test
    public void updateOrAddDiffOrder() {
        Order order = new Order();
        order.setOrderId(99L);
        order.setOrderNo("MT0000099");
        order.setProductName("霸气水果桶");
        order.setPurchaseName("汤姆帅锅一枚");
        orderService.diff(null, order);
    }

    @Test
    public void noRecordDiffOrder() {
        Order order = new Order();
        order.setOrderId(88L);
        order.setOrderNo("MT0000099");
        order.setProductName("麻辣烫套餐");
        order.setPurchaseName("杰瑞帅锅一枚");
        Order.UserInfo userInfo = new Order.UserInfo();
        userInfo.setUserId(9002L);
        userInfo.setUserName("杰瑞");
        order.setCreator(userInfo);
        order.setItems(Arrays.asList("123", "aaa"));

        Order order_ = new Order();
        order_.setOrderId(88L);
        order_.setOrderNo("MT0000099");
        order_.setProductName("麻辣烫套餐");
        order_.setPurchaseName("杰瑞帅锅一枚");
        Order.UserInfo userInfo_ = new Order.UserInfo();
        userInfo_.setUserId(9002L);
        userInfo_.setUserName("杰瑞");
        order_.setCreator(userInfo_);
        order_.setItems(Arrays.asList("123", "aaa"));

        orderService.diff(order, order_);
    }

    @Test
    public void oneDiffParamsOne() {
        Order order = new Order();
        order.setOrderId(88L);
        order.setOrderNo("MT0000099");
        order.setProductName("麻辣烫套餐");
        order.setPurchaseName("杰瑞帅锅一枚");
        orderService.diff(order);
    }

    @Test
    public void oneDiffParamsTwo() {
        Order order = new Order();
        order.setOrderId(88L);
        order.setOrderNo("MT0000099");
        order.setProductName("麻辣烫套餐");
        order.setPurchaseName("杰瑞帅锅一枚");
        orderService.diff_(order);
    }

    @Test
    public void conditionArrayUpdate() {
        Order order = new Order();
        order.setOrderId(188L);
        order.setOrderNo("MT00000929");
        order.setProductName("麻辣烫套餐");
        order.setPurchaseName("汤米帅锅一枚");
        Order.UserInfo userInfo = new Order.UserInfo();
        userInfo.setUserId(9012L);
        userInfo.setUserName("汤米");
        order.setCreator(userInfo);
        order.setItems(Arrays.asList("正常", "多点肉"));
        order.setExtraInfo(new String[]{"AQ", "WE"});

        Order order_ = new Order();
        order_.setOrderId(288L);
        order_.setOrderNo("MT00000919");
        order_.setProductName("红烧肉套餐");
        order_.setPurchaseName("约翰帅锅一枚");
        Order.UserInfo userInfo_ = new Order.UserInfo();
        userInfo_.setUserId(9022L);
        userInfo_.setUserName("约翰");
        order_.setCreator(userInfo_);
        order_.setItems(Arrays.asList("正常", "大份"));
        order_.setExtraInfo(new String[]{"MK", "PI"});

        orderService.diff(order, order_);
    }


    @Test
    public void conditionArrayAdd() {
        Order order = new Order();
        order.setOrderId(188L);
        order.setOrderNo("MT00000929");
        order.setProductName("麻辣烫套餐");
        order.setPurchaseName("汤米帅锅一枚");
        Order.UserInfo userInfo = new Order.UserInfo();
        userInfo.setUserId(9012L);
        userInfo.setUserName("汤米");
        order.setCreator(userInfo);
        order.setItems(Arrays.asList("正常", "多点肉"));

        Order order_ = new Order();
        order_.setOrderId(288L);
        order_.setOrderNo("MT00000919");
        order_.setProductName("红烧肉套餐");
        order_.setPurchaseName("约翰帅锅一枚");
        Order.UserInfo userInfo_ = new Order.UserInfo();
        userInfo_.setUserId(9022L);
        userInfo_.setUserName("约翰");
        order_.setCreator(userInfo_);
        order_.setItems(Arrays.asList("正常", "大份"));
        order_.setExtraInfo(new String[]{"MK", "PI"});

        orderService.diff(order, order_);
    }


    @Test
    public void conditionArrayDeleted() {
        Order order = new Order();
        order.setOrderId(188L);
        order.setOrderNo("MT00000929");
        order.setProductName("麻辣烫套餐");
        order.setPurchaseName("汤米帅锅一枚");
        Order.UserInfo userInfo = new Order.UserInfo();
        userInfo.setUserId(9012L);
        userInfo.setUserName("汤米");
        order.setCreator(userInfo);
        order.setItems(Arrays.asList("正常", "多点肉"));
        order.setExtraInfo(new String[]{"MKY", "PIY"});


        Order order_ = new Order();
        order_.setOrderId(288L);
        order_.setOrderNo("MT00000919");
        order_.setProductName("红烧肉套餐");
        order_.setPurchaseName("约翰帅锅一枚");
        Order.UserInfo userInfo_ = new Order.UserInfo();
        userInfo_.setUserId(9022L);
        userInfo_.setUserName("约翰");
        order_.setCreator(userInfo_);
        order_.setItems(Arrays.asList("正常", "大份"));

        orderService.diff(order, order_);
    }

    @Test
    public void conditionPrintLogger() {
        Order order = new Order();
        order.setOrderNo("MT00000929");
        order.setProductName("麻辣烫套餐");
        order.setPurchaseName("汤米帅锅一枚");
        orderService.condition(1L, order, null);
    }

    @Test
    public void conditionNotPrintLogger() {
        Order order = new Order();
        order.setOrderNo("MT00000929");
        order.setProductName("麻辣烫套餐");
        order.setPurchaseName("汤米帅锅一枚");
        orderService.condition(1L, order, "no print");
    }

    @Test
    public void contextCallContextLogger() {
        Order order = new Order();
        order.setOrderNo("MT00000929");
        order.setProductName("麻辣烫套餐");
        order.setPurchaseName("汤米帅锅一枚");
        orderService.contextCallContext(1L, order);
    }

    @Test
    public void subTypeSPELLogger() {
        Order order = new Order();
        order.setOrderNo("MT00000929");
        order.setProductName("麻辣烫套餐");
        order.setPurchaseName("汤米帅锅一枚");
        orderService.subTypeSPEL(1L, order);
    }

    @Test
    public void variableInfoLogger() {
        Order order = new Order();
        order.setOrderNo("MT00000929");
        order.setProductName("麻辣烫套餐");
        order.setPurchaseName("汤米帅锅一枚");
        orderService.variableInfo(1L, order);
    }

    @Test
    public void resultOnSuccessLogger() {
        Order order = new Order();
        order.setOrderNo("MT00000929");
        order.setProductName("麻辣烫套餐");
        order.setPurchaseName("汤米帅锅一枚");
        orderService.resultOnSuccess(1L, order);
    }

    @Test
    public void resultOnFailLogger() {
        Order order = new Order();
        order.setOrderNo("MT00000929");
        order.setProductName("麻辣烫套餐");
        order.setPurchaseName("汤米帅锅一枚");
        orderService.resultOnFail(1L, order);
    }

    @Test
    public void resultNoLogger() {
        Order order = new Order();
        order.setOrderNo("MT00000929");
        order.setProductName("麻辣烫套餐");
        order.setPurchaseName("汤米帅锅一枚");
        orderService.resultNoLogger(1L, order);
    }

    @Test
    public void fixedCopyLogger() {
        orderService.fixedCopy("固定文案记录日志输出内容 下了一整夜的雨");
    }
    @Test
    public void fixedCopyFirstLogger() {
        LoggerRecordInterceptor interceptor = beanFactory.getBean(LoggerRecordInterceptor.class);
        interceptor.setDiffSameWhetherSaveLogger(true);
        User user = new User();
        user.setName("江小白");
        User oldUser = new User();
        oldUser.setName("江小白");
        orderService.fixedCopy_(user,oldUser);
    }
    @Test
    public void fixedCopySecondLogger() {
        LoggerRecordInterceptor interceptor = beanFactory.getBean(LoggerRecordInterceptor.class);
        interceptor.setDiffSameWhetherSaveLogger(false);
        User user = new User();
        user.setName("江小白");
        User oldUser = new User();
        oldUser.setName("江小白");
        orderService.fixedCopy_(user,oldUser);
    }

}
