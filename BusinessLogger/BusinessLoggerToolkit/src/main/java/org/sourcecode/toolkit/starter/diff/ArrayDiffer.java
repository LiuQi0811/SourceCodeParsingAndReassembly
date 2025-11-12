package org.sourcecode.toolkit.starter.diff;


import de.danielbechler.diff.access.Instances;
import de.danielbechler.diff.comparison.ComparisonStrategyResolver;
import de.danielbechler.diff.differ.Differ;
import de.danielbechler.diff.differ.DifferDispatcher;
import de.danielbechler.diff.identity.IdentityStrategyResolver;
import de.danielbechler.diff.node.DiffNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * @ClassName ArrayDiffer
 * @Description ArrayDiffer
 * @Author LiuQi
 */
public class ArrayDiffer implements Differ {
    private static final Logger LOGGER = LoggerFactory.getLogger(ArrayDiffer.class);
    private final DifferDispatcher differDispatcher;
    private final ComparisonStrategyResolver comparisonStrategyResolver;
    private final IdentityStrategyResolver identityStrategyResolver;

    public ArrayDiffer(DifferDispatcher differDispatcher, ComparisonStrategyResolver comparisonStrategyResolver, IdentityStrategyResolver identityStrategyResolver) {
        this.differDispatcher = differDispatcher;
        this.comparisonStrategyResolver = comparisonStrategyResolver;
        this.identityStrategyResolver = identityStrategyResolver;
    }

    @Override
    public boolean accepts(Class<?> aClass) {
        return !aClass.isPrimitive() && aClass.isArray();
    }

    @Override
    public DiffNode compare(DiffNode diffNode, Instances instances) {
        LOGGER.info("// TODO ArrayDiffer compare ");
        return null;
    }
}
