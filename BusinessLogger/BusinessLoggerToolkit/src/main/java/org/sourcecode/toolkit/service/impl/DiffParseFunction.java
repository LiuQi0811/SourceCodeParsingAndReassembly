package org.sourcecode.toolkit.service.impl;


import de.danielbechler.diff.ObjectDifferBuilder;
import de.danielbechler.diff.comparison.ComparisonService;
import de.danielbechler.diff.node.DiffNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.sourcecode.toolkit.context.LoggerRecordContext;
import org.sourcecode.toolkit.starter.diff.ArrayDiffer;
import org.sourcecode.toolkit.starter.diff.IDiffItemsToLoggerContentService;
import org.sourcecode.toolkit.starter.support.util.Util;
import org.springframework.aop.support.AopUtils;

import java.lang.reflect.InvocationTargetException;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * @ClassName DiffParseFunction
 * @Description DiffParseFunction
 * @Author LiuQi
 */
public class DiffParseFunction {
    private static final Logger LOGGER = LoggerFactory.getLogger(DiffParseFunction.class);
    public static final String DIFF_FUNCTION_NAME = "_DIFF";
    public static final String OUTDATED_OBJECT = "_OUTDATED_OBJECT";
    public final Set<Class<?>> COMPARISON_SET = new HashSet<>();

    private IDiffItemsToLoggerContentService diffItemsToLoggerContentService;

    public void setDiffItemsToLoggerContentService(IDiffItemsToLoggerContentService diffItemsToLoggerContentService) {
        this.diffItemsToLoggerContentService = diffItemsToLoggerContentService;
    }

    static {
        LOGGER.info(" ................................. DiffParseFunction ................................. ");
    }

    public String diff(Object value) {
        Object sourceValue = LoggerRecordContext.getMethodOrGlobal(OUTDATED_OBJECT);
        return diff(sourceValue, value);
    }

    public String diff(Object source, Object target) {
        if (source == null && target == null) {
            return Util.EMPTY;
        }
        if (source == null || target == null) {
            try {
                Class<?> aClass = source == null ? target.getClass() : source.getClass();
                source = source == null ? aClass.getDeclaredConstructor().newInstance() : source;
                target = target == null ? aClass.getDeclaredConstructor().newInstance() : target;
            } catch (InstantiationException | IllegalAccessException | NoSuchMethodException |
                     InvocationTargetException e) {
                throw new RuntimeException(e);
            }
        }
        if (!Objects.equals(AopUtils.getTargetClass(source.getClass()), AopUtils.getTargetClass(target.getClass()))) {
            LOGGER.error("The two object types of diff are different, source.class={}, target.class={}", source.getClass().toString(), target.getClass().toString());
            return Util.EMPTY;
        }
        ObjectDifferBuilder objectDifferBuilder = ObjectDifferBuilder.startBuilding();
        ObjectDifferBuilder register = objectDifferBuilder.differs().register((differDispatcher, nodeQueryService) -> new ArrayDiffer(differDispatcher, ((ComparisonService) objectDifferBuilder.comparison()), objectDifferBuilder.identity()));
        for (Class<?> aClass : COMPARISON_SET) {
            register.comparison().ofType(aClass)
                    .toUseEqualsMethod();
        }
        DiffNode diffNode = register
                .build()
                .compare(target, source);
        return diffItemsToLoggerContentService.toLoggerContent(diffNode, source, target);
    }

    public void addUseEqualsClass(Class<?> aClass) {
        COMPARISON_SET.add(aClass);
    }

    public void addUseEqualsClass(List<String> classList) {
        if (classList != null && !classList.isEmpty()) {
            for (String strClass : classList) {
                try {
                    Class<?> aClass = Class.forName(strClass);
                    COMPARISON_SET.add(aClass);
                } catch (ClassNotFoundException e) {
                    LOGGER.warn("Invalid comparison type, className={}", strClass);
                }
            }
        }
    }
}
