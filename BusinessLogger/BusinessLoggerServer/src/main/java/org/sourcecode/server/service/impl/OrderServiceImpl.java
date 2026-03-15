package org.sourcecode.server.service.impl;


import jakarta.annotation.Resource;
import org.sourcecode.server.entity.Order;
import org.sourcecode.server.entity.Result;
import org.sourcecode.server.entity.User;
import org.sourcecode.server.infrastructure.constants.LoggerRecordType;
import org.sourcecode.server.service.IOrderService;
import org.sourcecode.server.service.IUserService;
import org.sourcecode.server.service.IUserService_;
import org.sourcecode.toolkit.context.LoggerRecordContext;
import org.sourcecode.toolkit.service.impl.DiffParseFunction;
import org.sourcecode.toolkit.starter.annotation.LoggerRecord;
import org.springframework.stereotype.Service;

import java.util.Arrays;

/**
 * @ClassName OrderServiceImpl
 * @Description OrderServiceImpl
 * @Author LiuQi
 */
@Service
public class OrderServiceImpl implements IOrderService {
    @Resource
    private IUserService_ userService;

    @Override
    @LoggerRecord(success = "{{#order.purchaseName}} 在 {{#order.createTime}} 下了一个订单,购买商品「{{#order.productName}}」,变量「{{#innerOrder.productName}}」,下单结果:{{#_result}}", subType = "MANAGER_VIEW", type = LoggerRecordType.ORDER, extra = "{{#order.toString()}}", bizNo = "{{#order.orderNo}}", fail = "创建订单失败，失败原因：「{{#_errorMsg}}」")
    public boolean createOrder(Order order) {
        System.out.printf(" 【创建订单】orderNo %s\n", order.getOrderNo());
        // 创建Order 对象
        final Order orderInfo = new Order();
        orderInfo.setProductName("辣椒炒肉");
        LoggerRecordContext.putVariable("innerOrder", orderInfo);
        return true;
    }


    @Override
    @LoggerRecord(success = "{{#order.purchaseName}}下了一个订单,购买商品「{{#order.productName}}」,下单结果:{{#_result}}", subType = "MANAGER_VIEW", type = LoggerRecordType.ORDER, extra = "{{#order.toString()}}", bizNo = "{{#order.orderNo}}")
    @LoggerRecord(success = "{{#order.purchaseName}}下了一个订单,购买商品「{{#order.productName}}」,下单结果:{{#_result}}", subType = "USER_VIEW", type = LoggerRecordType.USER, bizNo = "{{#order.orderNo}}")
    public boolean createOrders(Order order) {
        System.out.printf(" 【创建订单】orderNo %s\n", order.getOrderNo());
        return true;
    }

    @Override
    @LoggerRecord(fail = "创建订单失败，失败原因：「{{#_errorMessage}}」",
            subType = "MANAGER_VIEW",
            type = LoggerRecordType.ORDER,
            extra = "{{#order.toString()}}",
            success = "{{#order.purchaseName}}下了一个订单,购买商品「{{#order.productName}}」,测试变量「{{#innerOrder.productName}}」,下单结果:{{#_result}}",
            bizNo = "{{#order.orderNo}}"
    )
    public boolean createOrderToFail(Order order) {
        // 创建Order 对象
        final Order orderInfo = new Order();
        orderInfo.setProductName("超级香回锅肉");
        LoggerRecordContext.putVariable("innerOrder", orderInfo);
        if (order.getProductName().length() > 1) {
            throw new RuntimeException("订单超时啦 未及时付款！");
        }
        return true;
    }

    @Override
    @LoggerRecord(success = "更新了订单{ORDER_BEFORE{#order.orderId}},更新内容为... {ORDER_BEFORE{#order.productName}}",
            type = LoggerRecordType.ORDER,
            bizNo = "{{#order.orderNo}}",
            extra = "{{#order.toString()}}"
    )
    public boolean updateOrderBefore(Long orderId, Order order) {
        order.setOrderId(11000L);
        return false;
    }

    @Override
    @LoggerRecord(success = "更新了订单{ORDER{#order.productName}},更新内容为... ",
            type = LoggerRecordType.ORDER,
            bizNo = "{{#order.orderNo}}",
            extra = "{{#order.toString()}}"
    )
    public boolean updateOrderAfter(Long orderId, Order order) {
        order.setOrderId(116000L);
        order.setProductName("麻辣香锅");
        return false;
    }

    @Override
    @LoggerRecord(success = "美元符号测试 {DOLLAR{#order.productName}} !",
            type = LoggerRecordType.ORDER,
            bizNo = "{{#order.orderNo}}",
            extra = "{{#order.toString()}}"
    )
    public boolean dollar(Long orderId, Order order) {
        return false;
    }

    @Override
    @LoggerRecord(success = "更新了订单{IDENTITY{#order.orderId}},更新商品{IDENTITY{#order.productName}} 为... {{#order.productName}}",
            type = LoggerRecordType.ORDER,
            bizNo = "{{#order.orderNo}}",
            extra = "{{#order.toString()}}"
    )
    public boolean identity(Long orderId, Order order) {
        order.setProductName("辣椒炒小鱼");
        return false;
    }

    @Override
    @LoggerRecord(success = "更新了订单{_DIFF{#order,#newOrder}}",
            type = LoggerRecordType.ORDER,
            bizNo = "{{#newOrder.orderNo}}",
            extra = "{{#newOrder.toString()}}"
    )
    public boolean diff(Order order, Order newOrder) {
        return false;
    }

    @Override
    @LoggerRecord(success = "更新了订单{_DIFF{#newOrder}}",
            type = LoggerRecordType.ORDER,
            bizNo = "{{#newOrder.orderNo}}",
            extra = "{{#newOrder.toString()}}"
    )
    public boolean diff(Order newOrder) {
        LoggerRecordContext.putVariable(DiffParseFunction.OUTDATED_OBJECT, null);
        return false;
    }

    @Override
    @LoggerRecord(success = "更新了订单{_DIFF{#newOrder}}",
            type = LoggerRecordType.ORDER,
            bizNo = "{{#newOrder.orderNo}}",
            extra = "{{#newOrder.toString()}}"
    )
    public boolean diff_(Order newOrder) {
        Order order = new Order();
        order.setOrderId(188L);
        order.setOrderNo("MT00000991");
        order.setProductName("油烫鸭");
        order.setPurchaseName("萨瑞帅锅一枚");
        Order.UserInfo userInfo = new Order.UserInfo();
        userInfo.setUserId(9032L);
        userInfo.setUserName("萨瑞");
        order.setCreator(userInfo);
        LoggerRecordContext.putVariable(DiffParseFunction.OUTDATED_OBJECT, order);
        return false;
    }

    @Override
    @LoggerRecord(success = "更新了订单{ORDER{#orderId}},更新内容为...",
            type = LoggerRecordType.ORDER, bizNo = "{{#order.orderNo}}",
            condition = "{{#condition == null}}")
    public boolean condition(Long orderId, Order order, String condition) {
        return false;
    }

    @Override
    @LoggerRecord(success = "更新了订单{ORDER{#orderId}},更新内容为..{{#title}}",
            type = LoggerRecordType.ORDER, bizNo = "{{#order.orderNo}}")
    public boolean contextCallContext(Long orderId, Order order) {
        LoggerRecordContext.putVariable("title", " This is a Title");
        userService.getUserList(Arrays.asList("LiuQi", "Yun", "Xia"));
        return false;
    }

    @Override
    @LoggerRecord(success = "更新了订单{ORDER{#orderId}},更新内容为..{{#title}}",
            type = LoggerRecordType.ORDER,
            subType = "{{#order.orderNo}}",
            bizNo = "{{#order.orderNo}}")
    public boolean subTypeSPEL(Long orderId, Order order) {
        LoggerRecordContext.putVariable("title", "不要辣");
        return false;
    }

    @Override
    @LoggerRecord(success = "更新了订单{ORDER{#orderId}},更新内容为..{{#title}}",
            type = LoggerRecordType.ORDER, bizNo = "{{#order.orderNo}}")
    public boolean variableInfo(Long orderId, Order order) {
        return false;
    }

    @Override
    @LoggerRecord(success = "更新成功了订单{ORDER{#orderId}},更新内容为...",
            fail = "更新失败了订单{ORDER{#orderId}},更新内容为...",
            type = LoggerRecordType.ORDER, bizNo = "{{#order.orderNo}}",
            condition = "{{#condition == null}}", successCondition = "{{#result.code == 200}}")
    public Result<Boolean> resultOnSuccess(Long orderId, Order order) {
        Result<Boolean> result = new Result<>(200, "成功", true);
        LoggerRecordContext.putVariable("result", result);
        return result;
    }

    @Override
    @LoggerRecord(success = "更新成功了订单{ORDER{#orderId}},更新内容为...",
            fail = "更新失败了订单{ORDER{#orderId}},更新内容为...",
            type = LoggerRecordType.ORDER, bizNo = "{{#order.orderNo}}",
            condition = "{{#condition == null}}", successCondition = "{{#result.code == 200}}")
    public Result<Boolean> resultOnFail(Long orderId, Order order) {
        Result<Boolean> result = new Result<>(500, "服务错误", false);
        LoggerRecordContext.putVariable("result", result);
        return result;
    }

    @Override
    @LoggerRecord(success = "更新成功了订单{ORDER{#orderId}},更新内容为...",
            type = LoggerRecordType.ORDER, bizNo = "{{#order.orderNo}}",
            condition = "{{#condition == null}}", successCondition = "{{#result.code == 200}}")
    public Result<Boolean> resultNoLogger(Long orderId, Order order) {
        Result<Boolean> result = new Result<>(500, "服务错误", false);
        LoggerRecordContext.putVariable("result", result);
        return result;
    }

    @Override
    @LoggerRecord(success = "更新用户{{#user.name}}的订单{ORDER{#order.orderId}}信息,更新内容为...",
            type = LoggerRecordType.USER, bizNo = "{{#user.id}}")
    public boolean globalVariable(Order order) {
        return false;
    }

    @Override
    @LoggerRecord(success = "更新用户{{#user.name}}的订单{ORDER{#order.orderId}}信息,更新内容为...",
            type = LoggerRecordType.USER, bizNo = "{{#user.id}}")
    public boolean globalVariableCover(Order order, User user) {
        return false;
    }

    @Override
    @LoggerRecord(success = "固定文案记录日志",
            type = LoggerRecordType.USER, bizNo = "{{#text}}")
    public void fixedCopy(String text) {

    }

    @Override
    @LoggerRecord(success = "更新了用户{_DIFF{#user, #oldUser}}",
            type = LoggerRecordType.USER, bizNo = "{{#user.name}}",
            extra = "{{#user.toString()}}")
    public void fixedCopy_(User user, User oldUser) {

    }


}
