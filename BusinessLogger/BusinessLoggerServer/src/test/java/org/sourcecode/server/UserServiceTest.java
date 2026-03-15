package org.sourcecode.server;


import jakarta.annotation.Resource;
import org.junit.jupiter.api.Test;
import org.sourcecode.server.entity.Order;
import org.sourcecode.server.entity.User;
import org.sourcecode.server.infrastructure.loggerRecord.service.DBLoggerRecordService;
import org.sourcecode.server.service.IUserService;
import org.sourcecode.toolkit.starter.support.aop.LoggerRecordInterceptor;
import org.springframework.beans.factory.BeanFactory;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * @ClassName UserServiceTest
 * @Description UserServiceTest
 * @Author LiuQi
 */
public class UserServiceTest extends BaseTest {
    @Resource
    private IUserService userService;
    @Resource
    private DBLoggerRecordService loggerRecordService;
    @Resource
    private BeanFactory beanFactory;

    @Test
    public void diffUser() {
        User user = new User();
        user.setId(1L);
        user.setName("江小白");
        user.setSex("男");
        user.setAge(18);
        User.Address address = new User.Address();
        address.setProvinceName("湖北省");
        address.setCityName("武汉市");
        user.setAddress(address);
        User newUser = new User();
        newUser.setId(1L);
        newUser.setName("岚");
        newUser.setSex("女");
        newUser.setAge(20);
        User.Address newAddress = new User.Address();
        newAddress.setProvinceName("湖南省");
        newAddress.setCityName("长沙市");
        newUser.setAddress(newAddress);
        userService.diffUser(user, newUser);
    }

    @Test
    public void globalVariableUser() {
        User user = new User();
        user.setId(1L);
        user.setName("岚");
        user.setSex("女");
        user.setAge(20);
        User.Address newAddress = new User.Address();
        newAddress.setProvinceName("湖南省");
        newAddress.setCityName("长沙市");
        user.setAddress(newAddress);
        Order order = new Order();
        order.setOrderId(88L);
        order.setOrderNo("MT0000099");
        order.setProductName("麻辣烫套餐");
        order.setPurchaseName("岚美女一枚");
        userService.globalVariable(user, order);
    }

    @Test
    public void globalVariableCoverUser() {
        User user = new User();
        user.setId(1L);
        user.setName("岚");
        user.setSex("女");
        user.setAge(20);
        User.Address newAddress = new User.Address();
        newAddress.setProvinceName("湖南省");
        newAddress.setCityName("长沙市");
        user.setAddress(newAddress);
        Order order = new Order();
        order.setOrderId(88L);
        order.setOrderNo("MT0000099");
        order.setProductName("麻辣烫套餐");
        order.setPurchaseName("岚美女一枚");
        userService.globalVariableCover(user, order);
    }

    @Test
    public void abstractUser() {
        User user = new User();
        user.setId(1L);
        user.setName("斯沃特");
        user.setSex("男");
        user.setAge(18);
        User.Address address = new User.Address();
        address.setProvinceName("江苏省");
        address.setCityName("徐州市");
        user.setAddress(address);
        User newUser = new User();
        newUser.setId(1L);
        newUser.setName("蝴蝶");
        newUser.setSex("女");
        newUser.setAge(20);
        User.Address newAddress = new User.Address();
        newAddress.setProvinceName("山东省");
        newAddress.setCityName("枣庄市");
        newUser.setAddress(newAddress);
        userService.abstractUser(user, newUser);
    }

    @Test
    public void interfaceUser() {
        User user = new User();
        user.setId(1L);
        user.setName("刀锋");
        user.setSex("男");
        user.setAge(18);
        User.Address address = new User.Address();
        address.setProvinceName("江苏省");
        address.setCityName("苏州市");
        user.setAddress(address);
        User newUser = new User();
        newUser.setId(1L);
        newUser.setName("兰");
        newUser.setSex("女");
        newUser.setAge(20);
        User.Address newAddress = new User.Address();
        newAddress.setProvinceName("山东省");
        newAddress.setCityName("青岛市");
        newUser.setAddress(newAddress);
        userService.interfaceUser(user, newUser);
    }


    @Test
    public void interfaceAndAbstractUser() {
        User user = new User();
        user.setId(1L);
        user.setName("野原新之助");
        user.setSex("男");
        user.setAge(18);
        User.Address address = new User.Address();
        address.setProvinceName("日本");
        address.setCityName("东京");
        user.setAddress(address);
        User newUser = new User();
        newUser.setId(1L);
        newUser.setName("樱田妮妮");
        newUser.setSex("女");
        newUser.setAge(20);
        User.Address newAddress = new User.Address();
        newAddress.setProvinceName("日本");
        newAddress.setCityName("大阪");
        newUser.setAddress(newAddress);
        userService.interfaceAndAbstract(user, newUser);
    }


    @Test
    public void diffUserIgnore() {
        User user = new User();
        user.setId(1L);
        user.setName("野原广志");
        user.setSex("男");
        user.setAge(18);
        User.Address address = new User.Address();
        address.setProvinceName("日本");
        address.setCityName("东京");
        user.setAddress(address);
        List<String> likeList = new ArrayList<>();
        likeList.add("锅盔");
        likeList.add("热干面");
        likeList.add("豆皮");
        user.setLikeList(likeList);
        user.setTestList(Collections.singletonList(address));
        List<String> noLikeList = new ArrayList<>();
        noLikeList.add("蛙");
        noLikeList.add("鱼");
        user.setNoLikeList(noLikeList);
        user.setLikeStrings(new String[]{"A", "B", "C"});
        user.setNoLikeStrings(new String[]{"K", "P", "M"});


        User newUser = new User();
        newUser.setId(1L);
        newUser.setName("野原美冴");
        newUser.setSex("女");
        newUser.setAge(20);
        User.Address newAddress = new User.Address();
        newAddress.setProvinceName("日本");
        newAddress.setCityName("大阪");
        newUser.setAddress(newAddress);
        List<String> newLikeList = new ArrayList<>();
        newLikeList.add("臭豆腐");
        newLikeList.add("茶颜悦色");
        newUser.setLikeList(newLikeList);
        newUser.setTestList(Collections.singletonList(newAddress));
        List<String> newNoLikeList = new ArrayList<>();
        newNoLikeList.add("虾");
        newNoLikeList.add("龟");
        newUser.setNoLikeList(newNoLikeList);
        newUser.setLikeStrings(new String[]{"A", "P", "C"});
        newUser.setNoLikeStrings(new String[]{"K", "J", "U"});

        userService.diffUser(user, newUser);
    }

    @Test
    public void localDateTimeUser() {
        User user = new User();
        user.setId(1L);
        LocalDateTime now = LocalDateTime.now();
        user.setLocalDateTime(now);

        User newUser = new User();
        newUser.setId(1L);
        newUser.setLocalDateTime(LocalDateTime.MIN);

        userService.diffUser(user, newUser);
    }

    @Test
    public void sameDiffNotRecordUser() {
        User user = new User();
        user.setId(1L);
        User newUser = new User();
        newUser.setId(1L);
        userService.diffUser(user, newUser);
    }

    @Test
    public void sameDiffNotRecordWithMoreExpressionUser() {
        User user = new User();
        user.setId(1L);
        User newUser = new User();
        newUser.setId(1L);
        userService.diffUser2Expression(user, newUser);
    }

    @Test
    public void diffLoggerTrueUser() {
        LoggerRecordInterceptor interceptor = beanFactory.getBean(LoggerRecordInterceptor.class);
        interceptor.setDiffSameWhetherSaveLogger(true);
        User user = new User();
        user.setId(1L);
        user.setName("江小白");
        user.setSex("男");
        user.setAge(18);
        User.Address address = new User.Address();
        address.setProvinceName("湖北省");
        address.setCityName("武汉市");
        user.setAddress(address);
        userService.diffUser(user, user);
    }

    @Test
    public void diffLoggerFalseUser() {
        LoggerRecordInterceptor interceptor = beanFactory.getBean(LoggerRecordInterceptor.class);
        interceptor.setDiffSameWhetherSaveLogger(false);
        User user = new User();
        user.setId(1L);
        user.setName("江小白");
        user.setSex("男");
        user.setAge(18);
        User.Address address = new User.Address();
        address.setProvinceName("湖北省");
        address.setCityName("武汉市");
        user.setAddress(address);
        userService.diffUser(user, user);
    }

    @Test
    public void globalVariableDiffUser() {
        User user = new User();
        user.setId(1L);
        user.setName("江小白");
        user.setSex("男");
        user.setAge(18);
        User.Address address = new User.Address();
        address.setProvinceName("湖北省");
        address.setCityName("武汉市");
        user.setAddress(address);
        userService.globalVariableDiff(user);
    }

}
