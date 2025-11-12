package org.sourcecode.toolkit.starter.diff;


import de.danielbechler.diff.node.DiffNode;

/**
 * @ClassName IDiffItemsToLoggerContentService
 * @Description IDiffItemsToLoggerContentService
 * @Author LiuQi
 */
public interface IDiffItemsToLoggerContentService {
    String toLoggerContent(DiffNode diffNode, final Object sourceObject, final Object targetObject);
}
