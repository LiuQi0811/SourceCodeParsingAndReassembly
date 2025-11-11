package org.sourcecode.toolkit.bean;


import java.io.Serializable;
import java.util.Date;
import java.util.Map;

/**
 * @ClassName LoggerRecord
 * @Description LoggerRecord
 * @Author LiuQi
 */
public class LoggerRecord {
    private Serializable id;
    private String tenant;
    private String type;
    private String subType;
    private String bizNo;
    private String operator;
    private String action;
    private boolean fail;
    private Date createTime;
    private String extra;
    private Map<CodeVariableType, Object> codeVariable;

    public Serializable getId() {
        return id;
    }

    public void setId(Serializable id) {
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

    public Map<CodeVariableType, Object> getCodeVariable() {
        return codeVariable;
    }

    public void setCodeVariable(Map<CodeVariableType, Object> codeVariable) {
        this.codeVariable = codeVariable;
    }

    @Override
    public String toString() {
        return "LoggerRecord{" +
                "id=" + id +
                ", tenant='" + tenant + '\'' +
                ", type='" + type + '\'' +
                ", subType='" + subType + '\'' +
                ", bizNo='" + bizNo + '\'' +
                ", operator='" + operator + '\'' +
                ", action='" + action + '\'' +
                ", fail=" + fail +
                ", createTime=" + createTime +
                ", extra='" + extra + '\'' +
                ", codeVariable=" + codeVariable +
                '}';
    }
}
