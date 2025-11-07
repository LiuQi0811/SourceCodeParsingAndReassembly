package org.sourcecode.server;


import org.sourcecode.toolkit.starter.annotation.EnableLoggerRecord;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.ConfigurableApplicationContext;

/**
 * @ClassName BusinessLoggerApplication
 * @Description BusinessLoggerApplication
 * @Author LiuQi
 */
@EnableLoggerRecord(tenant = "")
@SpringBootApplication
public class BusinessLoggerApplication {
    public static void main(String[] args) {
        ConfigurableApplicationContext applicationContext = SpringApplication.run(BusinessLoggerApplication.class, args);
        System.out.println(" BusinessLoggerApplication start Successful! " + applicationContext.getApplicationName());
    }
}
