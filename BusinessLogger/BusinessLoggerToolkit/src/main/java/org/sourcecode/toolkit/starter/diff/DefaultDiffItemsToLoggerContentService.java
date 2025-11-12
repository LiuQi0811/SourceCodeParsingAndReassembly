package org.sourcecode.toolkit.starter.diff;


import de.danielbechler.diff.node.DiffNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.sourcecode.toolkit.starter.annotation.DiffLoggerAllFields;
import org.sourcecode.toolkit.starter.annotation.DiffLoggerField;
import org.sourcecode.toolkit.starter.annotation.DiffLoggerIgnore;
import org.sourcecode.toolkit.starter.configuration.LoggerRecordProperties;
import org.sourcecode.toolkit.starter.support.util.Util;
import org.springframework.beans.BeansException;
import org.springframework.beans.factory.BeanFactory;
import org.springframework.beans.factory.BeanFactoryAware;
import org.springframework.beans.factory.SmartInitializingSingleton;

import java.util.Collection;
import java.util.HashSet;
import java.util.Set;

/**
 * @ClassName DefaultDiffItemsToLoggerContentService
 * @Description DefaultDiffItemsToLoggerContentService
 * @Author LiuQi
 */
public class DefaultDiffItemsToLoggerContentService implements IDiffItemsToLoggerContentService, BeanFactoryAware, SmartInitializingSingleton {
    private static final Logger LOGGER = LoggerFactory.getLogger(DefaultDiffItemsToLoggerContentService.class);
    private final LoggerRecordProperties loggerRecordProperties;

    public DefaultDiffItemsToLoggerContentService(LoggerRecordProperties properties) {
        this.loggerRecordProperties = properties;
    }

    @Override
    public String toLoggerContent(DiffNode diffNode, final Object sourceObject, final Object targetObject) {
        if (!diffNode.hasChanges()) {
            return Util.EMPTY;
        }
        // TODO .....
        DiffLoggerAllFields annotation = sourceObject.getClass().getAnnotation(DiffLoggerAllFields.class);
        StringBuilder builder = new StringBuilder();
        Set<DiffNode> diffNodes = new HashSet<>();
        diffNode.visit((node, visit) -> allFieldLoggerGenerate(sourceObject, targetObject, builder, node, annotation, diffNodes));
        return "";
    }

    private void allFieldLoggerGenerate(Object sourceObject, Object targetObject, StringBuilder builder, DiffNode diffNode, DiffLoggerAllFields annotation, Set<DiffNode> diffNodes) {
        if (diffNode.isRootNode() || diffNode.getValueTypeInfo() != null || diffNodes.contains(diffNode)) {
            return;
        }
        DiffLoggerIgnore diffLoggerIgnoreAnnotation = diffNode.getFieldAnnotation(DiffLoggerIgnore.class);
        if (diffLoggerIgnoreAnnotation != null) {
            LOGGER.info("// TODO diffLoggerIgnoreAnnotation != null ");
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
        LOGGER.info(" // TODO allFieldLoggerGenerate =>   {} ", loggerContent);

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
        String fieldNamePrefix = "";
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
        // TODO
        return null;
    }

    private String getDiffLoggerContent(String filedLoggerName, DiffNode diffNode, Object sourceObject, Object targetObject, String functionName) {
        // TODO
        return null;
    }

    @Override
    public void setBeanFactory(BeanFactory beanFactory) throws BeansException {
        // TODO .....
        LOGGER.info(" // TODO DefaultDiffItemsToLoggerContentService  setBeanFactory");
    }

    @Override
    public void afterSingletonsInstantiated() {
        // TODO .....
        LOGGER.info(" // TODO DefaultDiffItemsToLoggerContentService  afterSingletonsInstantiated");
    }
}
