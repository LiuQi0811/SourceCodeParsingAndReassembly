package org.sourcecode.server.function;


import org.sourcecode.toolkit.service.IParseFunction;
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
}
