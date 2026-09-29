#include <CoreGraphics/CoreGraphics.h>
#include <stdio.h>
int main(void){
 CGDirectDisplayID id=CGMainDisplayID();CGRect b=CGDisplayBounds(id);
 printf("{\"x\":%.0f,\"y\":%.0f,\"width\":%.0f,\"height\":%.0f,\"pixelsWidth\":%zu,\"pixelsHeight\":%zu}\n",b.origin.x,b.origin.y,b.size.width,b.size.height,CGDisplayPixelsWide(id),CGDisplayPixelsHigh(id));
 return 0;
}
