package org.sourcecode.server.function;


import org.sourcecode.server.entity.Order;
import org.sourcecode.toolkit.service.IParseFunction;
import org.sourcecode.toolkit.starter.support.util.Util;
import org.springframework.stereotype.Component;

/**
 * @ClassName OrderBeforeParseFunction
 * @Description OrderBeforeParseFunction
 * @Author LiuQi
 */
@Component
public class OrderBeforeParseFunction implements IParseFunction {
    @Override
    public String functionName() {
        return "ORDER_BEFORE";
    }

    @Override
    public boolean executeBefore() {
        return true;
    }

    @Override
    public String apply(Object value) {
        if (Util.isEmpty(value)) {
            return Util.EMPTY;
        }
        Order order = new Order();
        order.setProductName("商品名称");
        return order.getProductName()
                .concat("(")
                .concat(value.toString())
                .concat(")");
    }
}
