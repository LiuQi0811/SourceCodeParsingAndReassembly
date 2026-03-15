package org.sourcecode.server.entity;


import org.sourcecode.toolkit.starter.annotation.DiffLoggerField;

import java.util.Arrays;
import java.util.Date;
import java.util.List;

/**
 * @ClassName Order
 * @Description Order
 * @Author LiuQi
 */
public class Order {
    @DiffLoggerField(name = "订单编号", function = "ORDER")
    private Long orderId;
    @DiffLoggerField(name = "订单号")
    private String orderNo;
    private String purchaseName;
    private String productName;
    @DiffLoggerField(name = "创建时间")
    private Date createTime;
    @DiffLoggerField(name = "创建人")
    private UserInfo creator;
    @DiffLoggerField(name = "更新人")
    private UserInfo updater;
    @DiffLoggerField(name = "列表项", function = "ORDER")
    private List<String> items;
    @DiffLoggerField(name = "拓展信息", function = "extraInfo")
    private String[] extraInfo;

    public Long getOrderId() {
        return orderId;
    }

    public void setOrderId(Long orderId) {
        this.orderId = orderId;
    }

    public String getOrderNo() {
        return orderNo;
    }

    public void setOrderNo(String orderNo) {
        this.orderNo = orderNo;
    }

    public String getPurchaseName() {
        return purchaseName;
    }

    public void setPurchaseName(String purchaseName) {
        this.purchaseName = purchaseName;
    }

    public String getProductName() {
        return productName;
    }

    public void setProductName(String productName) {
        this.productName = productName;
    }

    public Date getCreateTime() {
        return createTime;
    }

    public void setCreateTime(Date createTime) {
        this.createTime = createTime;
    }

    public UserInfo getCreator() {
        return creator;
    }

    public void setCreator(UserInfo creator) {
        this.creator = creator;
    }

    public UserInfo getUpdater() {
        return updater;
    }

    public void setUpdater(UserInfo updater) {
        this.updater = updater;
    }

    public List<String> getItems() {
        return items;
    }

    public void setItems(List<String> items) {
        this.items = items;
    }

    public String[] getExtraInfo() {
        return extraInfo;
    }

    public void setExtraInfo(String[] extraInfo) {
        this.extraInfo = extraInfo;
    }

    @Override
    public String toString() {
        return "Order{" +
                "orderId=" + orderId +
                ", orderNo='" + orderNo + '\'' +
                ", purchaseName='" + purchaseName + '\'' +
                ", productName='" + productName + '\'' +
                ", createTime=" + createTime +
                ", creator=" + creator +
                ", updater=" + updater +
                ", items=" + items +
                ", extraInfo=" + Arrays.toString(extraInfo) +
                '}';
    }

    public static class UserInfo {
        @DiffLoggerField(name = "用户ID")
        private Long userId;
        @DiffLoggerField(name = "用户名称")
        private String userName;

        public Long getUserId() {
            return userId;
        }

        public void setUserId(Long userId) {
            this.userId = userId;
        }

        public String getUserName() {
            return userName;
        }

        public void setUserName(String userName) {
            this.userName = userName;
        }
    }
}
