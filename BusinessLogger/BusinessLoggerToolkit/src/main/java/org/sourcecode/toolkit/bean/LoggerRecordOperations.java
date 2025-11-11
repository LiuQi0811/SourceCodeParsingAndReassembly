package org.sourcecode.toolkit.bean;


/**
 * @ClassName LoggerRecordOperations
 * @Description LoggerRecordOperations
 * @Author LiuQi
 */
public class LoggerRecordOperations {
    private String successLoggerTemplate;
    private String failLoggerTemplate;
    private String operatorId;
    private String type;
    private String bizNo;
    private String subType;
    private String extra;
    private String condition;
    private String isSuccess;

    public String getSuccessLoggerTemplate() {
        return successLoggerTemplate;
    }

    public void setSuccessLoggerTemplate(String successLoggerTemplate) {
        this.successLoggerTemplate = successLoggerTemplate;
    }

    public String getFailLoggerTemplate() {
        return failLoggerTemplate;
    }

    public void setFailLoggerTemplate(String failLoggerTemplate) {
        this.failLoggerTemplate = failLoggerTemplate;
    }

    public String getOperatorId() {
        return operatorId;
    }

    public void setOperatorId(String operatorId) {
        this.operatorId = operatorId;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getBizNo() {
        return bizNo;
    }

    public void setBizNo(String bizNo) {
        this.bizNo = bizNo;
    }

    public String getSubType() {
        return subType;
    }

    public void setSubType(String subType) {
        this.subType = subType;
    }

    public String getExtra() {
        return extra;
    }

    public void setExtra(String extra) {
        this.extra = extra;
    }

    public String getCondition() {
        return condition;
    }

    public void setCondition(String condition) {
        this.condition = condition;
    }

    public String getIsSuccess() {
        return isSuccess;
    }

    public void setIsSuccess(String isSuccess) {
        this.isSuccess = isSuccess;
    }

    @Override
    public String toString() {
        return "LoggerRecordOptions{" +
                "successLoggerTemplate='" + successLoggerTemplate + '\'' +
                ", failLoggerTemplate='" + failLoggerTemplate + '\'' +
                ", operatorId='" + operatorId + '\'' +
                ", type='" + type + '\'' +
                ", bizNo='" + bizNo + '\'' +
                ", subType='" + subType + '\'' +
                ", extra='" + extra + '\'' +
                ", condition='" + condition + '\'' +
                ", isSuccess='" + isSuccess + '\'' +
                '}';
    }
}
