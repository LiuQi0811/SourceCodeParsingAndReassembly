package org.sourcecode.toolkit.starter.diff;


import de.danielbechler.diff.node.DiffNode;
import de.danielbechler.diff.selector.ElementSelector;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.sourcecode.toolkit.service.IFunctionService;
import org.sourcecode.toolkit.starter.annotation.DiffLoggerAllFields;
import org.sourcecode.toolkit.starter.annotation.DiffLoggerField;
import org.sourcecode.toolkit.starter.annotation.DiffLoggerIgnore;
import org.sourcecode.toolkit.starter.configuration.LoggerRecordProperties;
import org.sourcecode.toolkit.starter.support.util.Util;
import org.springframework.beans.BeansException;
import org.springframework.beans.factory.BeanFactory;
import org.springframework.beans.factory.BeanFactoryAware;
import org.springframework.beans.factory.SmartInitializingSingleton;
import org.springframework.util.ReflectionUtils;

import java.lang.reflect.Field;
import java.util.*;

/**
 * @ClassName DefaultDiffItemsToLoggerContentService
 * @Description DefaultDiffItemsToLoggerContentService
 * @Author LiuQi
 */
public class DefaultDiffItemsToLoggerContentService implements IDiffItemsToLoggerContentService, BeanFactoryAware, SmartInitializingSingleton {
    private static final Logger LOGGER = LoggerFactory.getLogger(DefaultDiffItemsToLoggerContentService.class);
    private static final String CHILDREN = "children";
    private final LoggerRecordProperties loggerRecordProperties;
    private IFunctionService functionService;
    private BeanFactory beanFactory;

    public DefaultDiffItemsToLoggerContentService(LoggerRecordProperties properties) {
        this.loggerRecordProperties = properties;
    }

    @Override
    public String toLoggerContent(DiffNode diffNode, final Object sourceObject, final Object targetObject) {
        if (!diffNode.hasChanges()) {
            return Util.EMPTY;
        }
        DiffLoggerAllFields annotation = sourceObject.getClass().getAnnotation(DiffLoggerAllFields.class);
        StringBuilder builder = new StringBuilder();
        Set<DiffNode> diffNodes = new HashSet<>();
        diffNode.visit((node, visit) -> allFieldLoggerGenerate(sourceObject, targetObject, builder, node, annotation, diffNodes));
        diffNodes.clear();
        return builder.toString().replaceAll(loggerRecordProperties.getFieldSeparator().concat(Util.DOLLAR), Util.EMPTY);
    }

    private void allFieldLoggerGenerate(Object sourceObject, Object targetObject, StringBuilder builder, DiffNode diffNode, DiffLoggerAllFields annotation, Set<DiffNode> diffNodes) {
        if (diffNode.isRootNode() || diffNode.getValueTypeInfo() != null || diffNodes.contains(diffNode)) {
            return;
        }
        DiffLoggerIgnore diffLoggerIgnoreAnnotation = diffNode.getFieldAnnotation(DiffLoggerIgnore.class);
        if (diffLoggerIgnoreAnnotation != null) {
            memorandumHandler(diffNode,diffNodes);
            return;
        }
        DiffLoggerField diffLoggerFieldAnnotation = diffNode.getFieldAnnotation(DiffLoggerField.class);
        if (annotation == null && diffLoggerFieldAnnotation == null) {
            return;
        }
        String fieldLoggerName = getFieldLoggerName(diffNode, diffLoggerFieldAnnotation, annotation != null);
        if (Util.isEmpty(fieldLoggerName)) {
            return;
        }
        boolean isValueContainer = isValueContainer(diffNode, sourceObject, targetObject);
        String functionName = diffLoggerFieldAnnotation != null ? diffLoggerFieldAnnotation.function() : Util.EMPTY;
        String loggerContent = isValueContainer ? getCollectionDiffLoggerContent(fieldLoggerName, diffNode, sourceObject, targetObject, functionName)
                : getDiffLoggerContent(fieldLoggerName, diffNode, sourceObject, targetObject, functionName);
        if (!Util.isEmpty(loggerContent)) {
            builder.append(loggerContent)
                    .append(loggerRecordProperties.getFieldSeparator());
        }
        memorandumHandler(diffNode, diffNodes);
    }

    private void memorandumHandler(DiffNode diffNode, Set<DiffNode> diffNodes) {
        diffNodes.add(diffNode);
        if (diffNode.hasChildren()) {
            Field childrenField = ReflectionUtils.findField(DiffNode.class, CHILDREN);
            assert childrenField != null;
            ReflectionUtils.makeAccessible(childrenField);
            Map<ElementSelector, DiffNode> field = (Map<ElementSelector, DiffNode>) ReflectionUtils.getField(childrenField, diffNode);
            assert field != null;
            for (DiffNode value : field.values()) {
                memorandumHandler(value, diffNodes);
            }
        }
    }

    private String getFieldLoggerName(DiffNode diffNode, DiffLoggerField diffLoggerFieldAnnotation, boolean isField) {
        String fieldLoggerName = diffLoggerFieldAnnotation != null ? diffLoggerFieldAnnotation.name() : diffNode.getPropertyName();
        if (diffNode.getParentNode() != null) {
            fieldLoggerName = getParentFieldName(diffNode, isField) + fieldLoggerName;
        }
        return fieldLoggerName;
    }

    private String getParentFieldName(DiffNode diffNode, boolean isField) {
        DiffNode parentNode = diffNode.getParentNode();
        String fieldNamePrefix = Util.EMPTY;
        while (parentNode != null) {
            DiffLoggerField diffLoggerFieldAnnotation = parentNode.getFieldAnnotation(DiffLoggerField.class);
            if ((diffLoggerFieldAnnotation == null && !isField) || parentNode.isRootNode()) {
                parentNode = parentNode.getParentNode();
                continue;
            }
            fieldNamePrefix = diffLoggerFieldAnnotation != null ? diffLoggerFieldAnnotation.name()
                    .concat(loggerRecordProperties.getOfWord())
                    .concat(fieldNamePrefix)
                    : parentNode.getPropertyName()
                    .concat(loggerRecordProperties.getOfWord())
                    .concat(fieldNamePrefix);
            parentNode = parentNode.getParentNode();
        }
        return fieldNamePrefix;
    }

    private boolean isValueContainer(DiffNode diffNode, Object sourceObject, Object targetObject) {
        if (sourceObject != null) {
            Object sourceValue = diffNode.canonicalGet(sourceObject);
            if (sourceValue == null) {
                if (targetObject != null) {
                    Object targetValue = diffNode.canonicalGet(targetObject);
                    return targetValue instanceof Collection<?> || targetValue.getClass().isArray();
                }
            } else {
                return sourceValue instanceof Collection<?> || sourceValue.getClass().isArray();
            }
        }
        return false;
    }

    private String getCollectionDiffLoggerContent(String filedLoggerName, DiffNode diffNode, Object sourceObject, Object targetObject, String functionName) {
        Collection<Object> sourceCollection = getCollectionValue(diffNode, sourceObject);
        Collection<Object> targetCollection = getCollectionValue(diffNode, targetObject);
        Collection<Object> insertItemCollection = collectionSubtract(targetCollection, sourceCollection);
        Collection<Object> removeItemCollection = collectionSubtract(sourceCollection, targetCollection);
        String insertContent = collectionToContent(functionName, insertItemCollection);
        String removeContent = collectionToContent(functionName, removeItemCollection);
        return loggerRecordProperties.formatList(filedLoggerName, insertContent, removeContent);
    }

    private String getDiffLoggerContent(String filedLoggerName, DiffNode diffNode, Object sourceObject, Object targetObject, String functionName) {
        switch (diffNode.getState()) {
            case ADDED -> {
                return loggerRecordProperties.formatAdd(filedLoggerName, getFunctionValue(getFieldValue(diffNode, targetObject), functionName));
            }
            case CHANGED -> {
                return loggerRecordProperties.formatUpdate(filedLoggerName, getFunctionValue(getFieldValue(diffNode, sourceObject), functionName), getFunctionValue(getFieldValue(diffNode, targetObject), functionName));
            }
            case REMOVED -> {
                return loggerRecordProperties.formatDeleted(filedLoggerName, getFunctionValue(getFieldValue(diffNode, sourceObject), functionName));
            }
            default -> {
                LOGGER.warn("diff logger not support");
                return Util.EMPTY;
            }
        }
    }

    private Collection<Object> getCollectionValue(DiffNode diffNode, Object value) {
        Object fieldSourceValue = getFieldValue(diffNode, value);
        if (fieldSourceValue != null && fieldSourceValue.getClass().isArray()) {
            return new ArrayList<>(Arrays.asList(((Object[]) fieldSourceValue)));
        }
        return fieldSourceValue == null ? new ArrayList<>() : ((Collection<? super Object>) fieldSourceValue);
    }

    private Collection<Object> collectionSubtract(Collection<Object> minuend, Collection<Object> subTractor) {
        Collection<Object> result = new ArrayList<>(minuend);
        result.removeAll(subTractor);
        return result;
    }

    private String collectionToContent(String functionName, Collection<Object> collection) {
        StringBuilder builder = new StringBuilder();
        if (!Util.isEmpty(collection)) {
            for (Object value : collection) {
                builder.append(getFunctionValue(value, functionName))
                        .append(loggerRecordProperties.getListItemSeparator());
            }
        }
        return builder.toString().replaceAll(loggerRecordProperties.getListItemSeparator() + Util.DOLLAR, Util.EMPTY);
    }

    private String getFunctionValue(Object canonicalGet, String functionName) {
        if (Util.isEmpty(functionName)) {
            return canonicalGet.toString();
        }
        return functionService.apply(functionName, canonicalGet.toString());
    }

    private Object getFieldValue(DiffNode diffNode, Object value) {
        return diffNode.canonicalGet(value);
    }

    @Override
    public void setBeanFactory(BeanFactory beanFactory) throws BeansException {
        this.beanFactory = beanFactory;
    }

    @Override
    public void afterSingletonsInstantiated() {
        functionService = beanFactory.getBean(IFunctionService.class);
    }
}
