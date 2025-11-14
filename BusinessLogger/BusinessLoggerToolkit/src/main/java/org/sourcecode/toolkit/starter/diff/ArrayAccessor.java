package org.sourcecode.toolkit.starter.diff;


import de.danielbechler.diff.access.Accessor;
import de.danielbechler.diff.access.TypeAwareAccessor;
import de.danielbechler.diff.identity.IdentityStrategy;
import de.danielbechler.diff.selector.CollectionItemElementSelector;
import de.danielbechler.diff.selector.ElementSelector;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.Iterator;

/**
 * @ClassName ArrayAccessor
 * @Description ArrayAccessor
 * @Author LiuQi
 */
public class ArrayAccessor implements TypeAwareAccessor, Accessor {
    private final Object value;
    private final IdentityStrategy identityStrategy;

    public ArrayAccessor(final Object value, final IdentityStrategy identityStrategy) {
        this.value = value;
        this.identityStrategy = identityStrategy;
    }

    @Override
    public Class<?> getType() {
        return value != null ? value.getClass() : null;
    }

    @Override
    public ElementSelector getElementSelector() {
        CollectionItemElementSelector elementSelector = new CollectionItemElementSelector(value);
        return identityStrategy == null ? elementSelector : elementSelector.copyWithIdentityStrategy(identityStrategy);
    }

    @Override
    public Object get(Object o) {
        Collection<?> collections = objectAsCollections(o);
        if (collections == null) {
            return null;
        }
        for (Object collection : collections) {
            if (collection != null && identityStrategy.equals(collection, value)) {
                return collection;
            }
        }
        return null;
    }

    @Override
    public void set(Object o, Object o1) {
        Collection<? super Object> collections = (Collection<? super Object>) objectAsCollections(o);
        if (collections == null) {
            return;
        }
        Object previous = get(o);
        if (previous != null) {
            unset(o);
        }
        collections.add(o1);
    }

    @Override
    public void unset(Object o) {
        Collection<?> collections = objectAsCollections(o);
        if (collections == null) {
            return;
        }
        Iterator<?> iterator = collections.iterator();
        while (iterator.hasNext()) {
            Object value = iterator.next();
            if (value != null && identityStrategy.equals(value, this.value)) {
                iterator.remove();
                break;
            }
        }
    }

    @Override
    public String toString() {
        return "collection item " + getElementSelector();
    }

    private Collection<?> objectAsCollections(final Object value) {
        if (value == null) {
            return null;
        } else if (value.getClass().isArray()) {
            return new ArrayList<>(Arrays.asList((Object[]) value));
        }
        throw new IllegalArgumentException(value.getClass().toString());
    }
}
