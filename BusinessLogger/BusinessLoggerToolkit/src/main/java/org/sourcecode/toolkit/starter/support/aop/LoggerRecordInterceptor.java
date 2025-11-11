package org.sourcecode.toolkit.starter.support.aop;


import org.aopalliance.intercept.MethodInterceptor;
import org.aopalliance.intercept.MethodInvocation;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.sourcecode.toolkit.bean.CodeVariableType;
import org.sourcecode.toolkit.bean.LoggerRecord;
import org.sourcecode.toolkit.bean.LoggerRecordOperations;
import org.sourcecode.toolkit.bean.MethodExecuteResult;
import org.sourcecode.toolkit.context.LoggerRecordContext;
import org.sourcecode.toolkit.service.IFunctionService;
import org.sourcecode.toolkit.service.ILoggerRecordService;
import org.sourcecode.toolkit.service.IOperatorGetService;
import org.sourcecode.toolkit.starter.support.parse.LoggerFunctionParser;
import org.sourcecode.toolkit.starter.support.parse.LoggerRecordValueParser;
import org.sourcecode.toolkit.starter.support.util.Util;
import org.springframework.aop.framework.AopProxyUtils;
import org.springframework.aop.support.AopUtils;
import org.springframework.beans.factory.SmartInitializingSingleton;
import org.springframework.util.StopWatch;

import java.io.Serializable;
import java.lang.reflect.Method;
import java.util.*;

import static org.sourcecode.toolkit.service.ILoggerRecordPerformanceMonitor.MONITOR_TASK_AFTER_EXECUTE;
import static org.sourcecode.toolkit.service.ILoggerRecordPerformanceMonitor.MONITOR_TASK_BEFORE_EXECUTE;

/**
 * @ClassName LoggerRecordInterceptor
 * @Description LoggerRecordInterceptor
 * @Author LiuQi
 */
public class LoggerRecordInterceptor extends LoggerRecordValueParser implements MethodInterceptor, Serializable, SmartInitializingSingleton {
    private static final Logger log = LoggerFactory.getLogger(LoggerRecordInterceptor.class);
    private String tenantId;
    private LoggerRecordOperationSource loggerRecordOperationSource;
    private ILoggerRecordService loggerRecordService;
    private IOperatorGetService operatorGetService;

    public String getTenant() {
        return tenantId;
    }

    public void setTenant(String tenantId) {
        this.tenantId = tenantId;
    }

    public LoggerRecordOperationSource getLoggerRecordOperationSource() {
        return loggerRecordOperationSource;
    }

    public void setLoggerRecordOperationSource(LoggerRecordOperationSource loggerRecordOperationSource) {
        this.loggerRecordOperationSource = loggerRecordOperationSource;
    }

    public void setLoggerRecordService(ILoggerRecordService loggerRecordService) {
        this.loggerRecordService = loggerRecordService;
    }

    @Override
    public Object invoke(MethodInvocation invocation) throws Throwable {
        Method method = invocation.getMethod();
        return execute(invocation, invocation.getThis(), method, invocation.getArguments());
    }

    public Object execute(MethodInvocation methodInvocation, Object target, Method method, Object[] arguments) throws Throwable {
        if (AopUtils.isAopProxy(target)) {
            return methodInvocation.proceed();
        }
        StopWatch stopWatch = new StopWatch();
        stopWatch.start(MONITOR_TASK_BEFORE_EXECUTE);
        Class<?> targetClass = targetClass(target);
        Object result = null;
        MethodExecuteResult methodExecuteResult = new MethodExecuteResult(method, arguments, targetClass);
        LoggerRecordContext.putEmptySpan();
        Collection<LoggerRecordOperations> operations = new ArrayList<>();
        Map<String, String> functionNameAndReturnMap = new HashMap<>();
        try {
            operations = loggerRecordOperationSource.computeLoggerRecordOperations(method, targetClass);
            List<String> spELTemplates = getBeforeExecuteFunctionTemplate(operations);
            functionNameAndReturnMap = processBeforeExecuteFunctionTemplate(spELTemplates, targetClass, method, arguments);
        } catch (Exception e) {
            System.out.printf("logger record parse before function exception %s", e);
        } finally {
            stopWatch.stop();
        }
        try {
            result = methodInvocation.proceed();
            methodExecuteResult.setSuccess(true);
            methodExecuteResult.setResult(result);
        } catch (Exception e) {
            methodExecuteResult.setSuccess(false);
            methodExecuteResult.setThrowable(e);
            methodExecuteResult.setErrorMessage(e.getMessage());
        }
        stopWatch.start(MONITOR_TASK_AFTER_EXECUTE);
        try {
            if (!Util.isEmpty(operations)) {
                // TODO
                recordExecute(methodExecuteResult, functionNameAndReturnMap, operations);
            }
        } catch (Exception e) {
            System.out.printf("logger record parse exception %s", e);
            throw e;
        } finally {
            LoggerRecordContext.clear();
            stopWatch.stop();
            try {
                // TODO
            } catch (Exception e) {
                System.out.printf("execute exception %s", e);
            }
        }

        return result;
    }

    private Class<?> targetClass(Object target) {
        return AopProxyUtils.ultimateTargetClass(target);
    }

    private List<String> getBeforeExecuteFunctionTemplate(Collection<LoggerRecordOperations> operations) {
        List<String> spELTemplates = new ArrayList<>();
        operations.forEach(operation -> {
            List<String> templates = getSpELTemplates(operation, operation.getSuccessLoggerTemplate());
            if (!Util.isEmpty(templates)) {
                spELTemplates.addAll(templates);
            }
        });
        return spELTemplates;
    }

    private List<String> getSpELTemplates(LoggerRecordOperations operation, String... actions) {
        List<String> spELTemplates = new ArrayList<>();
        spELTemplates.add(operation.getType());
        spELTemplates.add(operation.getBizNo());
        spELTemplates.add(operation.getSubType());
        spELTemplates.add(operation.getExtra());
        spELTemplates.addAll(Arrays.asList(actions));
        return spELTemplates;
    }

    private void recordExecute(MethodExecuteResult methodExecuteResult, Map<String, String> functionNameAndReturnMap, Collection<LoggerRecordOperations> operations) {
        for (LoggerRecordOperations operation : operations) {
            try {
                if (Util.isEmpty(operation.getSuccessLoggerTemplate())
                        && Util.isEmpty(operation.getFailLoggerTemplate())) {
                    continue;
                }
                if (exitsCondition(methodExecuteResult, functionNameAndReturnMap, operation)) {
                    continue;
                }
                if (!methodExecuteResult.isSuccess()) {
                    // TODO
                } else {
                    successRecordExecute(methodExecuteResult, functionNameAndReturnMap, operation);
                }
            } catch (Exception e) {
                System.out.printf("logger record execute exception %s", e);
            }
        }
    }

    private boolean exitsCondition(MethodExecuteResult methodExecuteResult, Map<String, String> functionNameAndReturnMap, LoggerRecordOperations operation) {
        if (!Util.isEmpty(operation.getCondition())) {
            // TODO
            System.out.println("exitsCondition  ........." + operation);

        }
        return false;
    }

    private void successRecordExecute(MethodExecuteResult methodExecuteResult, Map<String, String> functionNameAndReturnMap, LoggerRecordOperations operation) {
        String action = "";
        boolean flag = true;
        if (!Util.isEmpty(operation.getIsSuccess())) {
            System.out.println(" !1");
        } else {
            action = operation.getSuccessLoggerTemplate();
        }
        if (action == null || action.isEmpty()) {
            return;
        }
        List<String> spELTemplates = getSpELTemplates(operation, action);
        String operatorIdFromServiceAndPutTemplate = getOperatorIdFromServiceAndPutTemplate(operation, spELTemplates);
        Map<String, String> expressionValues = processTemplate(spELTemplates, methodExecuteResult, functionNameAndReturnMap);
        saveLogger(methodExecuteResult.getMethod(), !flag, operation, operatorIdFromServiceAndPutTemplate, action, expressionValues);
    }

    private String getOperatorIdFromServiceAndPutTemplate(LoggerRecordOperations operation, List<String> spELTemplates) {
        String realOperatorId = "";
        if (Util.isEmpty(operation.getOperatorId())) {
            realOperatorId = operatorGetService.getUser().getOperatorId();
            if (Util.isEmpty(realOperatorId)) {
                throw new IllegalArgumentException("[LoggerRecord] operator is null");
            }
        } else {
            spELTemplates.add(operation.getOperatorId());
        }
        return realOperatorId;
    }

    private void saveLogger(Method method, boolean flag, LoggerRecordOperations operation, String operatorIdFromServiceAndPutTemplate, String action, Map<String, String> expressionValues) {
        if (Util.isEmpty(expressionValues.get(action)) ||
                (!diffSameWhetherSaveLogger && action.contains("#") && Objects.equals(action, expressionValues.get(action)))) {
            return;
        }
        LoggerRecord loggerRecord = new LoggerRecord();
        loggerRecord.setBizNo(expressionValues.get(operation.getBizNo()));
        loggerRecord.setType(expressionValues.get(operation.getType()));
        loggerRecord.setSubType(expressionValues.get(operation.getSubType()));
        loggerRecord.setTenant(tenantId);
        loggerRecord.setOperator(getRealOperatorId(operation, operatorIdFromServiceAndPutTemplate, expressionValues));
        loggerRecord.setCodeVariable(getCodeVariable(method));
        loggerRecord.setExtra(expressionValues.get(operation.getExtra()));
        loggerRecord.setAction(expressionValues.get(action));
        loggerRecord.setFail(flag);
        loggerRecord.setCreateTime(new Date());
        loggerRecordService.record(loggerRecord);
    }

    private String getRealOperatorId(LoggerRecordOperations operation, String operatorIdFromServiceAndPutTemplate, Map<String, String> expressionValues) {
        return (operatorIdFromServiceAndPutTemplate != null || !operatorIdFromServiceAndPutTemplate.isEmpty()) ? operatorIdFromServiceAndPutTemplate : expressionValues.get(operation.getOperatorId());
    }

    private Map<CodeVariableType, Object> getCodeVariable(Method method) {
        Map<CodeVariableType, Object> variableTypeObjectMap = new HashMap<>();
        variableTypeObjectMap.put(CodeVariableType.ClassName, method.getDeclaringClass());
        variableTypeObjectMap.put(CodeVariableType.MethodName, method.getName());
        return variableTypeObjectMap;
    }

    @Override
    public void afterSingletonsInstantiated() {
        loggerRecordService = beanFactory.getBean(ILoggerRecordService.class);
        operatorGetService = beanFactory.getBean(IOperatorGetService.class);
        this.setLoggerFunctionParser(new LoggerFunctionParser(beanFactory.getBean(IFunctionService.class)));
        System.out.println(" SINGLETON ");
    }
}
