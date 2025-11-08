package org.sourcecode.server.function;


import org.sourcecode.toolkit.service.IParseFunction;
import org.springframework.stereotype.Component;

/**
 * @ClassName DollarParseFunction
 * @Description DollarParseFunction
 * @Author LiuQi
 */
@Component
public class DollarParseFunction implements IParseFunction {
    @Override
    public String functionName() {
        return "DOLLAR";
    }
}
