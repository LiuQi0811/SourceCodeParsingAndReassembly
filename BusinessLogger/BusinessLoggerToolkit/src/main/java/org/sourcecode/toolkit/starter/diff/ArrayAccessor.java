package org.sourcecode.toolkit.starter.diff;


import de.danielbechler.diff.access.Accessor;
import de.danielbechler.diff.access.TypeAwareAccessor;
import de.danielbechler.diff.identity.IdentityStrategy;
import de.danielbechler.diff.selector.CollectionItemElementSelector;
import de.danielbechler.diff.selector.ElementSelector;

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
        return null;
    }

    @Override
    public void set(Object o, Object o1) {
        System.out.println(" // TODO ............ SET .....................");
    }

    @Override
    public void unset(Object o) {

    }

    @Override
    public String toString() {
        return "collection item " + getElementSelector();
    }
}
