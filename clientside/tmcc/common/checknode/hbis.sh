#
# Copyright (c) 2013-2023 University of Utah and the Flux Group.
# 
# {{{EMULAB-LICENSE
# 
# This file is part of the Emulab network testbed software.
# 
# This file is free software: you can redistribute it and/or modify it
# under the terms of the GNU Affero General Public License as published by
# the Free Software Foundation, either version 3 of the License, or (at
# your option) any later version.
# 
# This file is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
# FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public
# License for more details.
# 
# You should have received a copy of the GNU Affero General Public License
# along with this file.  If not, see <http://www.gnu.org/licenses/>.
# 
# }}}
#

# hbis() How Big Is Size

# This function takes a unformatted string that is reportedly a presentation
#  of a memory size.
# It returns a number in MB

# size constents
KiB=1024
MiB=1048576
GiB=1073741824
TiB=1099511627776 # just for fun

hbis() {
    number=$1

# debug test strings
#number="250260kB"
#number="443124kB"
#number="4000848kB"
#number="8110204kB"
#number="13,676,544,000 bytes"
#number="8388608"
#number="146,815,733,760 bytes [146 GB]" is 136.73 GB
#number="499,289,948,160 bytes [456 GB]"
#number="500,107,862,016 bytes" is 465.761 GB
#number="536,870,912,000 bytes [500 GB]"
#number="[500 GB]"
#number="126 GB"
#number="131824428kB"

    base=""
    # little input checking - remove punction and spaces
    z=$(echo ${number} | tr -d [:punct:] | tr -d [:space:])
    y=$(echo ${z,,}) #lower case the letters

    # check for string 'bytes'
    if [ ${y%%bytes*} != ${y} ] ; then
	#remove the string 'ytes' and everthing after, leaving b for bytes
	y=$(echo ${y/ytes*/})
    fi

    if [ ${y%%m*} != ${y} ] ; then
	# strip letters
	number=${y%%m*}
	bytes=$((${number}*$MiB))
    elif [ ${y%%g*} != ${y} ] ; then
	number=${y%%g*}
	bytes=$((${number}*$GiB))
    elif [ ${y%%t*} != ${y} ] ; then
	number=${y%%t*}
	bytes=$((${number}*$TiB))
    elif [ ${y%%k*} != ${y} ] ; then
	number=${y%%k*}
	bytes=$((${number}*$KiB))
    else
	# no base given but might have commas (wouldn't because of tr above)
	z=${y%%[a-z]*}
	number=${z//,/}
	bytes=$number
    fi

    # so now we have the number in bytes
    xMB=$((bytes / $MiB)) # change to MB which is what tmcc hwinfo gives us
    echo $xMB
}
