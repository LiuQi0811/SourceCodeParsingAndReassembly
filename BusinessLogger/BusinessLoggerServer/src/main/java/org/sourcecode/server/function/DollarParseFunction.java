package org.sourcecode.server.function;


import org.sourcecode.toolkit.service.IParseFunction;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

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

    @Override
    public String apply(Object value) {
        System.out.println(" DollarParseFunction APPLY " + value);
        Map<String,Object> result = new HashMap<>();
        result.put("salePrice", "$" + 1.98);
        return result.toString();
    }
}
