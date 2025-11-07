package org.sourcecode.server.repository.entity;


import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.util.Date;

/**
 * @ClassName LoggerRecordEntity
 * @Description LoggerRecordEntity
 * @Author LiuQi
 */
@TableName(value = "t_logrecord")
public class LoggerRecordEntity {
    @TableId(value = "id", type = IdType.AUTO)
    private Long id;
    private String tenant;
    private String type;
    private String subType;
    private String bizNo;
    private String operator;
    private String action;
    private boolean fail;
    private Date createTime;
    private String extra;
    private String codeVariable;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTenant() {
        return tenant;
    }

    public void setTenant(String tenant) {
        this.tenant = tenant;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getSubType() {
        return subType;
    }

    public void setSubType(String subType) {
        this.subType = subType;
    }

    public String getBizNo() {
        return bizNo;
    }

    public void setBizNo(String bizNo) {
        this.bizNo = bizNo;
    }

    public String getOperator() {
        return operator;
    }

    public void setOperator(String operator) {
        this.operator = operator;
    }

    public String getAction() {
        return action;
    }

    public void setAction(String action) {
        this.action = action;
    }

    public boolean isFail() {
        return fail;
    }

    public void setFail(boolean fail) {
        this.fail = fail;
    }

    public Date getCreateTime() {
        return createTime;
    }

    public void setCreateTime(Date createTime) {
        this.createTime = createTime;
    }

    public String getExtra() {
        return extra;
    }

    public void setExtra(String extra) {
        this.extra = extra;
    }

    public String getCodeVariable() {
        return codeVariable;
    }

    public void setCodeVariable(String codeVariable) {
        this.codeVariable = codeVariable;
    }

    public LoggerRecordEntity(Long id, String tenant, String type, String subType, String bizNo, String operator, String action, boolean fail, Date createTime, String extra, String codeVariable) {
        this.id = id;
        this.tenant = tenant;
        this.type = type;
        this.subType = subType;
        this.bizNo = bizNo;
        this.operator = operator;
        this.action = action;
        this.fail = fail;
        this.createTime = createTime;
        this.extra = extra;
        this.codeVariable = codeVariable;
    }
}
