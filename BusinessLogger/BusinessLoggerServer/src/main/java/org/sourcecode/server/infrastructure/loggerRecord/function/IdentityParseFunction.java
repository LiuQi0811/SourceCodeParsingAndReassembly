package org.sourcecode.server.infrastructure.loggerRecord.function;


import org.sourcecode.toolkit.service.IParseFunction;
import org.springframework.stereotype.Component;

/**
 * @ClassName IdentityParseFunction
 * @Description IdentityParseFunction
 * @Author LiuQi
 */
@Component
public class IdentityParseFunction implements IParseFunction {
    @Override
    public String functionName() {
        return "IDENTITY";
    }

    @Override
    public boolean executeBefore() {
        return true;
    }

    @Override
    public String apply(Object value) {
        return value.toString();
    }
}
