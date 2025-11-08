package org.sourcecode.toolkit.starter.support.aop;


import org.aopalliance.intercept.MethodInterceptor;
import org.aopalliance.intercept.MethodInvocation;
import org.sourcecode.toolkit.bean.LoggerRecordOptions;
import org.sourcecode.toolkit.bean.MethodExecuteResult;
import org.sourcecode.toolkit.context.LoggerRecordContext;
import org.sourcecode.toolkit.service.IFunctionService;
import org.sourcecode.toolkit.service.ILoggerRecordService;
import org.sourcecode.toolkit.starter.support.parse.LoggerFunctionParser;
import org.sourcecode.toolkit.starter.support.parse.LoggerRecordValueParser;
import org.springframework.aop.framework.AopProxyUtils;
import org.springframework.aop.support.AopUtils;
import org.springframework.beans.factory.SmartInitializingSingleton;
import org.springframework.util.CollectionUtils;
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
    private LoggerRecordOperationSource loggerRecordOperationSource;
    private ILoggerRecordService loggerRecordService;

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
        Collection<LoggerRecordOptions> operations = new ArrayList<>();
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
            if (!CollectionUtils.isEmpty(operations)) {
                // TODO
                System.out.println(" TE " + operations);
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

    private List<String> getBeforeExecuteFunctionTemplate(Collection<LoggerRecordOptions> operations) {
        List<String> spELTemplates = new ArrayList<>();
        operations.forEach(operation -> {
            List<String> templates = getSpELTemplates(operation, operation.getSuccessLoggerTemplate());
            if (!CollectionUtils.isEmpty(templates)) {
                spELTemplates.addAll(templates);
            }
        });
        return spELTemplates;
    }

    private List<String> getSpELTemplates(LoggerRecordOptions operation, String... actions) {
        List<String> spELTemplates = new ArrayList<>();
        spELTemplates.add(operation.getType());
        spELTemplates.add(operation.getBizNo());
        spELTemplates.add(operation.getSubType());
        spELTemplates.add(operation.getExtra());
        spELTemplates.addAll(Arrays.asList(actions));
        return spELTemplates;
    }

    @Override
    public void afterSingletonsInstantiated() {
        loggerRecordService = beanFactory.getBean(ILoggerRecordService.class);
        this.setLoggerFunctionParser(new LoggerFunctionParser(beanFactory.getBean(IFunctionService.class)));
        System.out.println(" SINGLETON ");
    }
}
