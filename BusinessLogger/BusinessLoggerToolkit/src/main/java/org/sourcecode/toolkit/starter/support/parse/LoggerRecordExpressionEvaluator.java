package org.sourcecode.toolkit.starter.support.parse;


import org.springframework.aop.support.AopUtils;
import org.springframework.beans.factory.BeanFactory;
import org.springframework.context.expression.AnnotatedElementKey;
import org.springframework.context.expression.BeanFactoryResolver;
import org.springframework.context.expression.CachedExpressionEvaluator;
import org.springframework.expression.EvaluationContext;
import org.springframework.expression.Expression;

import java.lang.reflect.Method;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * @ClassName LoggerRecordExpressionEvaluator
 * @Description LoggerRecordExpressionEvaluator
 * @Author LiuQi
 */
public class LoggerRecordExpressionEvaluator extends CachedExpressionEvaluator {
    private final Map<AnnotatedElementKey, Method> targetMethodCache = new ConcurrentHashMap<>(64);
    private final Map<ExpressionKey, Expression> expressionCache = new ConcurrentHashMap<>(64);

    public Object parseExpression(String conditionExpression, AnnotatedElementKey annotatedElementKey, EvaluationContext evaluationContext) {
        return getExpression(expressionCache, annotatedElementKey, conditionExpression).getValue(evaluationContext, Object.class);
    }

    public EvaluationContext createEvaluationContext(Method method, Object[] arguments, Class<?> targetClass, Object value, String errorMessage, BeanFactory beanFactory) {
        Method targetMethod = getTargetMethod(targetClass, method);
        LoggerRecordEvaluationContext loggerRecordEvaluationContext = new LoggerRecordEvaluationContext(null, targetMethod, arguments, getParameterNameDiscoverer(), value, errorMessage);
        if (beanFactory != null) {
            loggerRecordEvaluationContext.setBeanResolver(new BeanFactoryResolver(beanFactory));
        }
        return loggerRecordEvaluationContext;
    }

    private Method getTargetMethod(Class<?> targetClass, Method method) {
        AnnotatedElementKey annotatedElementKey = new AnnotatedElementKey(method, targetClass);
        return targetMethodCache
                .computeIfAbsent(annotatedElementKey, elementKey -> AopUtils.getMostSpecificMethod(method, targetClass));
    }
}
