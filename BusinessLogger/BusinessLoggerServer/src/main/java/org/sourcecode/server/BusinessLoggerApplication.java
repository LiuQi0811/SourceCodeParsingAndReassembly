package org.sourcecode.server;


import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.ConfigurableApplicationContext;

/**
 * @ClassName BusinessLoggerApplication
 * @Description BusinessLoggerApplication
 * @Author LiuQi
 */
@SpringBootApplication
public class BusinessLoggerApplication {
    public static void main(String[] args) {
        ConfigurableApplicationContext applicationContext = SpringApplication.run(BusinessLoggerApplication.class, args);
        System.out.println(" BusinessLoggerApplication start Successful! " + applicationContext.getApplicationName());
    }
}
