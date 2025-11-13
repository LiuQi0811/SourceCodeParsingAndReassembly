package org.sourcecode.toolkit.starter.diff;


import de.danielbechler.diff.access.Accessor;
import de.danielbechler.diff.access.Instances;
import de.danielbechler.diff.comparison.ComparisonStrategy;
import de.danielbechler.diff.comparison.ComparisonStrategyResolver;
import de.danielbechler.diff.differ.Differ;
import de.danielbechler.diff.differ.DifferDispatcher;
import de.danielbechler.diff.identity.IdentityStrategy;
import de.danielbechler.diff.identity.IdentityStrategyResolver;
import de.danielbechler.diff.node.DiffNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.*;

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
    public DiffNode compare(final DiffNode diffNode, final Instances instances) {
        DiffNode _diffNode = createDiffNode(diffNode, instances);
        IdentityStrategy identityStrategy = identityStrategyResolver.resolveIdentityStrategy(_diffNode);
        if (identityStrategy != null) {
            _diffNode.setChildIdentityStrategy(identityStrategy);
        }
        if (instances.hasBeenAdded()) {
            LOGGER.info(" // TODO instances.hasBeenAdded() ");
        } else if (instances.hasBeenRemoved()) {
            LOGGER.info(" // TODO instances.hasBeenRemoved() ");
        } else if (instances.areSame()) {
            LOGGER.info(" // TODO  instances.areSame() ");
        } else {
            ComparisonStrategy comparisonStrategy = comparisonStrategyResolver.resolveComparisonStrategy(_diffNode);
            if (comparisonStrategy == null) {
                compareInternally(_diffNode, instances, identityStrategy);
            } else {
                LOGGER.info(" // TODO comparisonStrategy is not null");
            }
        }
        return _diffNode;
    }

    private DiffNode createDiffNode(final DiffNode parentNode, final Instances instances) {
        Accessor accessor = instances.getSourceAccessor();
        Class<?> valueType = instances.getType();
        return new DiffNode(parentNode, accessor, valueType);
    }

    private void compareInternally(final DiffNode diffNode, final Instances instances, final IdentityStrategy identityStrategy) {
        Collection<?> working = Arrays.asList(((Object[]) instances.getWorking()));
        Collection<?> base = Arrays.asList(((Object[]) instances.getBase()));
        
        Iterable<?> addLinkedList = new LinkedList<Object>(working);
        Iterable<?> removeLinkedList = new LinkedList<Object>(base);
        Iterable<?> knownLinkedList = new LinkedList<Object>(base);

        removeOperate(addLinkedList, base, identityStrategy);
        removeOperate(removeLinkedList, working, identityStrategy);
        removeOperate(knownLinkedList, addLinkedList, identityStrategy);
        removeOperate(knownLinkedList, removeLinkedList, identityStrategy);

        compareWith(diffNode, instances, addLinkedList, identityStrategy);
        compareWith(diffNode, instances, removeLinkedList, identityStrategy);
        compareWith(diffNode, instances, knownLinkedList, identityStrategy);
    }

    private void removeOperate(final Iterable<?> from, final Iterable<?> these, final IdentityStrategy identityStrategy) {
        Iterator<?> iterator = from.iterator();
        while (iterator.hasNext()) {
            Object value = iterator.next();
            if (containsCheck(these, value, identityStrategy)) {
                iterator.remove();
            }
        }
    }

    private boolean containsCheck(final Iterable<?> haystack, final Object needle, final IdentityStrategy identityStrategy) {
        for (Object value : haystack) {
            if (identityStrategy.equals(needle, value)) {
                return true;
            }
        }
        return false;
    }

    private void compareWith(final DiffNode parentNode, final Instances instances, final Iterable<?> iterable, final IdentityStrategy identityStrategy) {
        for (Object value : iterable) {
            Accessor arrayAccessor = new ArrayAccessor(value, identityStrategy);
            differDispatcher.dispatch(parentNode, instances, arrayAccessor);
        }
    }
}
